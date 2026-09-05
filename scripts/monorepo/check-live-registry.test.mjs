import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix, resolve } from "node:path";
import { test } from "node:test";
import {
  assertHeadOk,
  assertRegistryContentFresh,
  availabilitySentinels,
  buildAvailabilitySentinels,
  parseServedCopyTrees,
  publicRegistryIsGated,
  registryFreshnessTargets,
  requiredEndpoints,
  runLiveRegistryCheck,
} from "./check-live-registry.mjs";

const root = resolve(import.meta.dirname, "../..");

function collectJsonRelativePaths(directory, relativeDirectory = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      return collectJsonRelativePaths(join(directory, entry.name), relativePath);
    }
    return entry.isFile() && entry.name.endsWith(".json") ? [relativePath] : [];
  });
}

function toArrayBuffer(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function bodyResponse(value) {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => toArrayBuffer(value),
  };
}

const nonSentinelUrls = requiredEndpoints.filter((url) => !availabilitySentinels.includes(url));

test("required endpoints include the keys registry route", () => {
  assert.ok(requiredEndpoints.some((url) => url.includes("/r/keys/")));
});

test("required endpoints include the published editor schema", () => {
  assert.ok(requiredEndpoints.some((url) => url.endsWith("/schema/diffgazer.json")));
});

test("every served tree contributes one committed availability sentinel", () => {
  const servedDestinations = [
    ...new Set(
      parseServedCopyTrees(readFileSync(join(root, "deploy/registry.Dockerfile"), "utf8")).map(
        (tree) => tree.destination,
      ),
    ),
  ];

  assert.equal(availabilitySentinels.length, servedDestinations.length);
  for (const destination of servedDestinations) {
    assert.ok(
      availabilitySentinels.some((url) => url.startsWith(`https://r.b4r7.dev/${destination}`)),
      `no availability sentinel for served tree ${destination}`,
    );
  }
  for (const sentinel of availabilitySentinels) {
    assert.ok(requiredEndpoints.includes(sentinel));
  }
});

test("a served tree with no declared sentinel fails instead of going unprobed", () => {
  assert.throws(
    () => buildAvailabilitySentinels([{ source: "libs/new/public/r/", destination: "r/new/" }]),
    /No availability sentinel declared for served tree r\/new\//,
  );
});

test("required endpoints exhaust every JSON in the Docker-copied public trees", () => {
  const copiedTrees = [
    { source: "libs/ui/public/r", destination: "r/ui" },
    { source: "libs/keys/public/r", destination: "r/keys" },
    { source: "apps/docs/public/schema", destination: "schema" },
  ];
  const dockerfile = readFileSync(join(root, "deploy/registry.Dockerfile"), "utf8");
  // Compare against every served COPY the Dockerfile actually has, so a tree
  // added to the image cannot stay absent from both sides of the assertion.
  assert.deepEqual(
    parseServedCopyTrees(dockerfile),
    copiedTrees.map(({ source, destination }) => ({
      source: `${source}/`,
      destination: `${destination}/`,
    })),
  );
  const expectedUrls = copiedTrees
    .flatMap(({ source, destination }) =>
      collectJsonRelativePaths(join(root, source)).map(
        (relativePath) => `https://r.b4r7.dev/${posix.join(destination, relativePath)}`,
      ),
    )
    .sort();

  assert.deepEqual(requiredEndpoints, expectedUrls);
  assert.deepEqual(
    requiredEndpoints.slice().sort(),
    registryFreshnessTargets.map((target) => target.url).sort(),
  );
});

test("served COPY trees survive flags, extra sources, and continuations", () => {
  const dockerfile = [
    "FROM nginx AS runtime",
    "# comment",
    "COPY --chown=nginx:nginx libs/ui/public/r/ /usr/share/nginx/html/r/ui/",
    "COPY libs/keys/public/r/ apps/docs/public/schema/ /usr/share/nginx/html/r/",
    "COPY \\",
    "  deploy/registry-nginx.conf /etc/nginx/conf.d/default.conf",
    "",
  ].join("\n");

  assert.deepEqual(parseServedCopyTrees(dockerfile), [
    { source: "libs/ui/public/r/", destination: "r/ui/" },
    { source: "libs/keys/public/r/", destination: "r/" },
    { source: "apps/docs/public/schema/", destination: "r/" },
  ]);
});

test("a COPY the parser cannot read fails instead of dropping a served tree", () => {
  assert.throws(
    () => parseServedCopyTrees('COPY ["libs/ui/public/r/", "/usr/share/nginx/html/r/ui/"]\n'),
    /Unreadable COPY instruction/,
  );
});

test("assertHeadOk rejects non-200 responses", async () => {
  await assert.rejects(
    () =>
      assertHeadOk("https://r.b4r7.dev/r/keys/missing-route.json", async () => ({
        status: 404,
      })),
    /returned 404/,
  );
});

test("publicRegistryIsGated reads the HOSTED_REGISTRY_GATED literal", async () => {
  const dir = mkdtempSync(join(tmpdir(), "publish-gated-"));
  try {
    const gatedFile = join(dir, "gated.ts");
    writeFileSync(gatedFile, "export const HOSTED_REGISTRY_GATED = true;\n");
    assert.equal(await publicRegistryIsGated(gatedFile), true);

    const ungatedFile = join(dir, "ungated.ts");
    writeFileSync(ungatedFile, "export const HOSTED_REGISTRY_GATED = false;\n");
    assert.equal(await publicRegistryIsGated(ungatedFile), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("publicRegistryIsGated ignores documentation prose before the exported declaration", async () => {
  const dir = mkdtempSync(join(tmpdir(), "publish-gated-comment-"));
  try {
    const metadataFilePath = join(dir, "metadata.ts");
    writeFileSync(
      metadataFilePath,
      [
        "/**",
        " * The release script reads the HOSTED_REGISTRY_GATED = true|false assignment below.",
        " */",
        "export const HOSTED_REGISTRY_GATED = false;",
        "",
      ].join("\n"),
    );

    assert.equal(await publicRegistryIsGated(metadataFilePath), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--print-disposition reports an ungated metadata file as a run", () => {
  const dir = mkdtempSync(join(tmpdir(), "live-registry-disposition-"));
  try {
    const metadataFilePath = join(dir, "metadata.ts");
    writeFileSync(metadataFilePath, "export const HOSTED_REGISTRY_GATED = false;\n");

    const child = spawnSync(
      process.execPath,
      [
        join(root, "scripts/monorepo/check-live-registry.mjs"),
        "--metadata-file",
        metadataFilePath,
        "--print-disposition",
      ],
      {
        encoding: "utf8",
        env: { ...process.env, DIFFGAZER_LIVE_REGISTRY_REQUIRED: "0" },
      },
    );

    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout.trim(), "run");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an ungated run accepts an origin whose bodies match the committed registry", async () => {
  const dir = mkdtempSync(join(tmpdir(), "live-registry-fresh-"));
  try {
    const metadataFilePath = join(dir, "metadata.ts");
    writeFileSync(metadataFilePath, "export const HOSTED_REGISTRY_GATED = false;\n");

    let networkCalls = 0;
    const expectedBodies = new Map(
      registryFreshnessTargets.map((target) => [target.url, readFileSync(target.path)]),
    );
    await runLiveRegistryCheck({
      metadataFilePath,
      required: false,
      lookupImpl: async () => {
        networkCalls += 1;
      },
      fetchImpl: async (url, options) => {
        networkCalls += 1;
        return options?.method === "HEAD" ? { status: 200 } : bodyResponse(expectedBodies.get(url));
      },
      log: () => {},
    });

    assert.equal(networkCalls, 1 + availabilitySentinels.length);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("publicRegistryIsGated fails loudly when the literal is gone", async () => {
  const dir = mkdtempSync(join(tmpdir(), "publish-gated-"));
  try {
    const doctored = join(dir, "doctored.ts");
    writeFileSync(doctored, "export const SOMETHING_ELSE = true;\n");
    await assert.rejects(() => publicRegistryIsGated(doctored), /HOSTED_REGISTRY_GATED/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ungated readiness passes against an origin still serving the previous deploy", async () => {
  const dir = mkdtempSync(join(tmpdir(), "live-registry-ungated-"));
  // The endpoint this change set adds: committed locally, still a 404 upstream
  // until the deploy that this very readiness run gates.
  const [addedUrl] = nonSentinelUrls;
  assert.ok(addedUrl);

  const headUrls = [];
  let networkCalls = 0;
  const fetchImpl = async (url, options) => {
    networkCalls += 1;
    if (options?.method === "HEAD") {
      headUrls.push(url);
      return { status: url === addedUrl ? 404 : 200 };
    }
    return url === addedUrl
      ? { ok: false, status: 404, arrayBuffer: async () => toArrayBuffer("") }
      : bodyResponse("stale\n");
  };

  try {
    const metadataFilePath = join(dir, "metadata.ts");
    writeFileSync(metadataFilePath, "export const HOSTED_REGISTRY_GATED = false;\n");

    await runLiveRegistryCheck({
      metadataFilePath,
      required: false,
      lookupImpl: async () => {
        networkCalls += 1;
      },
      fetchImpl,
      log: () => {},
    });

    assert.deepEqual(headUrls, availabilitySentinels);
    assert.equal(networkCalls, 1 + availabilitySentinels.length);

    // The exhaustive proof stays with the post-deploy caller, which sets
    // DIFFGAZER_LIVE_REGISTRY_REQUIRED=1 after the image is serving.
    await assert.rejects(
      () =>
        runLiveRegistryCheck({
          metadataFilePath,
          required: true,
          lookupImpl: async () => {},
          fetchImpl,
          log: () => {},
        }),
      new RegExp(`${addedUrl.replaceAll("/", "\\/")} returned 404`),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("entry flow skips a gated registry only when the hard gate is not requested", async () => {
  const dir = mkdtempSync(join(tmpdir(), "live-registry-gated-"));
  try {
    const metadataFilePath = join(dir, "metadata.ts");
    writeFileSync(metadataFilePath, "export const HOSTED_REGISTRY_GATED = true;\n");
    let networkCalls = 0;

    await runLiveRegistryCheck({
      metadataFilePath,
      required: false,
      lookupImpl: async () => {
        networkCalls += 1;
      },
      fetchImpl: async () => {
        networkCalls += 1;
        throw new Error("Unexpected fetch");
      },
      log: () => {},
    });

    assert.equal(networkCalls, 0);

    const bodyByUrl = new Map(
      registryFreshnessTargets.map((target) => [target.url, readFileSync(target.path)]),
    );
    await runLiveRegistryCheck({
      metadataFilePath,
      required: true,
      lookupImpl: async () => {
        networkCalls += 1;
      },
      fetchImpl: async (url, options) => {
        networkCalls += 1;
        return options?.method === "HEAD" ? { status: 200 } : bodyResponse(bodyByUrl.get(url));
      },
      log: () => {},
    });
    assert.equal(networkCalls, 1 + requiredEndpoints.length * 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("assertRegistryContentFresh resolves when every mapped body matches its source", async () => {
  const bodyByUrl = new Map(
    registryFreshnessTargets.map((target) => [target.url, readFileSync(target.path)]),
  );

  await assertRegistryContentFresh(async (url) => bodyResponse(bodyByUrl.get(url)));
});

test("assertRegistryContentFresh catches stale and missing non-sentinel endpoints", async () => {
  const bodyByUrl = new Map(
    registryFreshnessTargets.map((target) => [target.url, readFileSync(target.path)]),
  );
  const [staleUrl, missingUrl] = nonSentinelUrls;
  assert.ok(staleUrl);
  assert.ok(missingUrl);

  await assert.rejects(
    () =>
      assertRegistryContentFresh(async (url) =>
        bodyResponse(url === staleUrl ? "stale\n" : bodyByUrl.get(url)),
      ),
    new RegExp(`SHA mismatch for ${staleUrl.replaceAll("/", "\\/")}`),
  );

  await assert.rejects(
    () =>
      assertRegistryContentFresh(async (url) =>
        url === missingUrl
          ? { ok: false, status: 404, arrayBuffer: async () => toArrayBuffer("") }
          : bodyResponse(bodyByUrl.get(url)),
      ),
    new RegExp(`${missingUrl.replaceAll("/", "\\/")} returned 404`),
  );
});
