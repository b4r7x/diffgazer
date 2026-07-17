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

async function buildRegistryFreshnessTargets() {
  const dockerfile = await readFile(registryDockerfilePath, "utf8");
  const copyPattern = /^COPY\s+(\S+)\s+\/usr\/share\/nginx\/html\/(\S+)\s*$/gm;
  const copiedTrees = [...dockerfile.matchAll(copyPattern)].map((match) => ({
    source: match[1],
    destination: match[2],
  }));
  if (copiedTrees.length === 0) {
    throw new Error(`No public JSON trees found in ${registryDockerfilePath}`);
  }

  const targets = await Promise.all(
    copiedTrees.map(async ({ source, destination }) => {
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
    /^export[ \t]+const[ \t]+PUBLISH_GATED[ \t]*=[ \t]*(true|false)[ \t]*;[ \t]*$/m,
  );
  if (!match) {
    throw new Error(
      `Could not find a 'PUBLISH_GATED = true|false' assignment in ${metadataFilePath}. ` +
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
