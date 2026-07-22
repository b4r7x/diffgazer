import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix, resolve } from "node:path";
import { test } from "node:test";
import {
  assertHeadOk,
  assertRegistryContentFresh,
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

const originalSentinels = new Set([
  "https://r.b4r7.dev/r/ui/registry.json",
  "https://r.b4r7.dev/r/ui/button.json",
  "https://r.b4r7.dev/r/keys/navigation.json",
  "https://r.b4r7.dev/schema/diffgazer.json",
]);
const nonSentinelUrls = registryFreshnessTargets
  .map((target) => target.url)
  .filter((url) => !originalSentinels.has(url));

test("required endpoints include the keys registry route", () => {
  assert.ok(requiredEndpoints.some((url) => url.includes("/r/keys/")));
});

test("required endpoints include the published editor schema", () => {
  assert.ok(requiredEndpoints.some((url) => url.endsWith("/schema/diffgazer.json")));
});

test("required endpoints exhaust every JSON in the Docker-copied public trees", () => {
  const copiedTrees = [
    { source: "libs/ui/public/r", destination: "r/ui" },
    { source: "libs/keys/public/r", destination: "r/keys" },
    { source: "apps/docs/public/schema", destination: "schema" },
  ];
  const dockerfile = readFileSync(join(root, "deploy/registry.Dockerfile"), "utf8");
  for (const { source, destination } of copiedTrees) {
    assert.ok(dockerfile.includes(`COPY ${source}/ /usr/share/nginx/html/${destination}/`));
  }
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

test("assertHeadOk rejects non-200 responses", async () => {
  await assert.rejects(
    () =>
      assertHeadOk("https://r.b4r7.dev/r/keys/missing-route.json", async () => ({
        status: 404,
      })),
    /returned 404/,
  );
});

test("publicRegistryIsGated reads the PUBLISH_GATED literal", async () => {
  const dir = mkdtempSync(join(tmpdir(), "publish-gated-"));
  try {
    const gatedFile = join(dir, "gated.ts");
    writeFileSync(gatedFile, "export const PUBLISH_GATED = true;\n");
    assert.equal(await publicRegistryIsGated(gatedFile), true);

    const ungatedFile = join(dir, "ungated.ts");
    writeFileSync(ungatedFile, "export const PUBLISH_GATED = false;\n");
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
        " * The release script reads the PUBLISH_GATED = true|false assignment below.",
        " */",
        "export const PUBLISH_GATED = false;",
        "",
      ].join("\n"),
    );

    assert.equal(await publicRegistryIsGated(metadataFilePath), false);

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

    assert.equal(networkCalls, 1 + requiredEndpoints.length * 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("publicRegistryIsGated fails loudly when the literal is gone", async () => {
  const dir = mkdtempSync(join(tmpdir(), "publish-gated-"));
  try {
    const doctored = join(dir, "doctored.ts");
    writeFileSync(doctored, "export const SOMETHING_ELSE = true;\n");
    await assert.rejects(() => publicRegistryIsGated(doctored), /PUBLISH_GATED/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("normal ungated entry flow rejects stale content even when every HEAD succeeds", async () => {
  const dir = mkdtempSync(join(tmpdir(), "live-registry-ungated-"));
  const bodyByUrl = new Map(
    registryFreshnessTargets.map((target) => [target.url, readFileSync(target.path)]),
  );
  const [staleUrl] = nonSentinelUrls;
  assert.ok(staleUrl);

  try {
    const metadataFilePath = join(dir, "metadata.ts");
    writeFileSync(metadataFilePath, "export const PUBLISH_GATED = false;\n");
    const headUrls = [];
    await assert.rejects(
      () =>
        runLiveRegistryCheck({
          metadataFilePath,
          required: false,
          lookupImpl: async () => {},
          fetchImpl: async (url, options) => {
            if (options?.method === "HEAD") {
              headUrls.push(url);
              return { status: 200 };
            }
            return url === staleUrl ? bodyResponse("stale\n") : bodyResponse(bodyByUrl.get(url));
          },
          log: () => {},
        }),
      new RegExp(`SHA mismatch for ${staleUrl.replaceAll("/", "\\/")}`),
    );
    assert.deepEqual(headUrls, requiredEndpoints);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("entry flow skips a gated registry only when the hard gate is not requested", async () => {
  const dir = mkdtempSync(join(tmpdir(), "live-registry-gated-"));
  try {
    const metadataFilePath = join(dir, "metadata.ts");
    writeFileSync(metadataFilePath, "export const PUBLISH_GATED = true;\n");
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
