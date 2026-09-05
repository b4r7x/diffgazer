import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { readdir, readFile } from "node:fs/promises";
import { join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "../..");
const metadataPath = resolve(root, "apps/docs/src/lib/consumption-metadata.ts");
const registryDockerfilePath = resolve(root, "deploy/registry.Dockerfile");
const registryOrigin = "https://r.b4r7.dev";

async function collectJsonFiles(directory, relativeDirectory = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = posix.join(relativeDirectory, entry.name);
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) return collectJsonFiles(absolutePath, relativePath);
      return entry.isFile() && entry.name.endsWith(".json") ? [{ absolutePath, relativePath }] : [];
    }),
  );
  return files.flat();
}

const NGINX_HTML_ROOT = "/usr/share/nginx/html";
const COPY_OPTION = /^--[a-z][a-z0-9-]*(?:=\S+)?(?:\s+|$)/i;

function readCopyArguments(dockerfile) {
  const copies = [];
  let logicalLine = "";

  for (const rawLine of dockerfile.split(/\r?\n/)) {
    const line = rawLine.trim();
    // Docker strips comment lines even inside a continuation; folding one into
    // the operands would silently move the destination off the served root.
    if (line.startsWith("#")) continue;
    if (logicalLine === "" && line === "") continue;

    const continued = line.endsWith("\\");
    const fragment = continued ? line.slice(0, -1).trim() : line;
    logicalLine = logicalLine === "" ? fragment : `${logicalLine} ${fragment}`;
    if (continued) continue;

    const copy = /^COPY\s+(.+)$/i.exec(logicalLine);
    if (copy) copies.push(copy[1]);
    logicalLine = "";
  }

  return copies;
}

// Shell form only: `COPY [--flag[=value]…] <src>… <dest>`. The JSON exec form
// carries no shell words, so it is reported as unparsable rather than guessed
// at — a COPY this cannot read must fail the check, never drop a served tree.
function parseCopyOperands(argumentsText) {
  let text = argumentsText.trim();
  while (text.startsWith("--")) {
    const option = COPY_OPTION.exec(text);
    if (!option) return null;
    text = text.slice(option[0].length).trimStart();
  }
  if (text.startsWith("[")) return null;

  const operands = text.split(/\s+/).filter(Boolean);
  return operands.length < 2
    ? null
    : { sources: operands.slice(0, -1), destination: operands.at(-1) };
}

// Every tree nginx serves must become a live endpoint, so an unreadable COPY is
// a failure: the destination is exactly what an unparsed line hides, and a
// silently skipped tree is deployed without any freshness verification.
export function parseServedCopyTrees(dockerfile) {
  const trees = [];

  for (const argumentsText of readCopyArguments(dockerfile)) {
    const copy = parseCopyOperands(argumentsText);
    if (!copy) {
      throw new Error(
        `Unreadable COPY instruction in ${registryDockerfilePath}: COPY ${argumentsText}`,
      );
    }

    const { sources, destination } = copy;
    if (destination !== NGINX_HTML_ROOT && !destination.startsWith(`${NGINX_HTML_ROOT}/`)) continue;

    const servedPath = destination.slice(NGINX_HTML_ROOT.length + 1);
    for (const source of sources) {
      trees.push({ source, destination: servedPath });
    }
  }

  return trees;
}

const servedCopyTrees = parseServedCopyTrees(await readFile(registryDockerfilePath, "utf8"));
if (servedCopyTrees.length === 0) {
  throw new Error(`No public JSON trees found in ${registryDockerfilePath}`);
}

async function buildRegistryFreshnessTargets() {
  const targets = await Promise.all(
    servedCopyTrees.map(async ({ source, destination }) => {
      const sourceRoot = resolve(root, source);
      const files = await collectJsonFiles(sourceRoot);
      return files.map(({ absolutePath, relativePath }) => ({
        url: `${registryOrigin}/${posix.join(destination, relativePath)}`,
        path: absolutePath,
      }));
    }),
  );
  return targets.flat().sort((a, b) => a.url.localeCompare(b.url));
}

// The Dockerfile COPY trees are the deployment contract, so every JSON added to
// any of them automatically becomes a required live endpoint.
export const registryFreshnessTargets = await buildRegistryFreshnessTargets();

export const requiredEndpoints = registryFreshnessTargets.map((target) => target.url);

// One long-lived endpoint per served tree. Pre-merge readiness probes only these:
// sweeping every locally derived endpoint would 404 on exactly the files a
// registry-adding change set introduces, and those cannot be live until the
// deploy that the same readiness run gates — the deadlock the post-deploy caller
// owns instead. A renamed or dropped sentinel fails here rather than degrading
// the readiness probe to DNS only.
const SENTINEL_FILE_BY_SERVED_TREE = new Map([
  ["r/ui/", "registry.json"],
  ["r/keys/", "registry.json"],
  ["schema/", "diffgazer.json"],
]);

export function buildAvailabilitySentinels(servedTrees) {
  const servedDestinations = [...new Set(servedTrees.map((tree) => tree.destination))];

  return servedDestinations.map((destination) => {
    const sentinelFile = SENTINEL_FILE_BY_SERVED_TREE.get(destination);
    if (!sentinelFile) {
      throw new Error(
        `No availability sentinel declared for served tree ${destination}; ` +
          "add one in check-live-registry.mjs so readiness still probes that tree.",
      );
    }

    const url = `${registryOrigin}/${posix.join(destination, sentinelFile)}`;
    if (!requiredEndpoints.includes(url)) {
      throw new Error(`Availability sentinel ${url} is not a committed registry endpoint`);
    }
    return url;
  });
}

export const availabilitySentinels = buildAvailabilitySentinels(servedCopyTrees);

export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function assertHeadOk(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    method: "HEAD",
    signal: AbortSignal.timeout(10_000),
  });

  if (response.status !== 200) {
    throw new Error(`${url} returned ${response.status}`);
  }
}

export async function assertRegistryContentFresh(fetchImpl = fetch) {
  for (const { url, path } of registryFreshnessTargets) {
    const localHash = sha256Hex(await readFile(path));
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      throw new Error(`${url} returned ${response.status}`);
    }
    const liveHash = sha256Hex(Buffer.from(await response.arrayBuffer()));
    if (localHash !== liveHash) {
      throw new Error(
        `Hosted registry content SHA mismatch for ${url} (local ${localHash.slice(0, 12)}… vs live ${liveHash.slice(0, 12)}…)`,
      );
    }
  }
}

export async function publicRegistryIsGated(metadataFilePath = metadataPath) {
  const source = await readFile(metadataFilePath, "utf8");
  const match = source.match(
    /^export[ \t]+const[ \t]+HOSTED_REGISTRY_GATED[ \t]*=[ \t]*(true|false)[ \t]*;[ \t]*$/m,
  );
  if (!match) {
    throw new Error(
      `Could not find a 'HOSTED_REGISTRY_GATED = true|false' assignment in ${metadataFilePath}. ` +
        "The live-check depends on this literal; update check-live-registry.mjs if it moved.",
    );
  }
  return match[1] === "true";
}

export async function getLiveRegistryDisposition({
  metadataFilePath = metadataPath,
  required = process.env.DIFFGAZER_LIVE_REGISTRY_REQUIRED === "1",
} = {}) {
  return (await publicRegistryIsGated(metadataFilePath)) && !required ? "skip" : "run";
}

export async function runLiveRegistryCheck({
  metadataFilePath = metadataPath,
  required = process.env.DIFFGAZER_LIVE_REGISTRY_REQUIRED === "1",
  lookupImpl = lookup,
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  if ((await getLiveRegistryDisposition({ metadataFilePath, required })) === "skip") {
    log("OK: hosted registry live check skipped while public registry commands are gated");
    return;
  }

  await lookupImpl("r.b4r7.dev");
  if (!required) {
    for (const endpoint of availabilitySentinels) {
      await assertHeadOk(endpoint, fetchImpl);
    }
    log("OK: hosted registry DNS and sentinel endpoints are reachable");
    return;
  }

  for (const endpoint of requiredEndpoints) {
    await assertHeadOk(endpoint, fetchImpl);
  }
  await assertRegistryContentFresh(fetchImpl);
  log("OK: hosted registry DNS, endpoints, and committed bytes are live");
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const metadataFlagIndex = process.argv.indexOf("--metadata-file");
  const metadataFilePath =
    metadataFlagIndex === -1 ? undefined : process.argv[metadataFlagIndex + 1];
  if (metadataFlagIndex !== -1 && !metadataFilePath) {
    throw new Error("--metadata-file requires a path");
  }

  if (process.argv.includes("--print-disposition")) {
    console.log(await getLiveRegistryDisposition({ metadataFilePath }));
  } else {
    await runLiveRegistryCheck({ metadataFilePath });
  }
}
