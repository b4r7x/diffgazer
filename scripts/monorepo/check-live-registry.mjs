import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "../..");
const metadataPath = resolve(root, "apps/docs/src/lib/consumption-metadata.ts");

// Each hosted URL maps to the committed artifact it must stay byte-for-byte identical to once live.
export const registryFreshnessTargets = [
  {
    url: "https://r.b4r7.dev/r/ui/registry.json",
    path: resolve(root, "libs/ui/public/r/registry.json"),
  },
  {
    url: "https://r.b4r7.dev/r/ui/button.json",
    path: resolve(root, "libs/ui/public/r/button.json"),
  },
  {
    url: "https://r.b4r7.dev/r/keys/navigation.json",
    path: resolve(root, "libs/keys/public/r/navigation.json"),
  },
  {
    url: "https://r.b4r7.dev/schema/diffgazer.json",
    path: resolve(root, "apps/docs/public/schema/diffgazer.json"),
  },
];

export const requiredEndpoints = registryFreshnessTargets.map((target) => target.url);

export function sha256Hex(text) {
  return createHash("sha256").update(text).digest("hex");
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
    const localHash = sha256Hex(await readFile(path, "utf8"));
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      throw new Error(`${url} returned ${response.status}`);
    }
    const liveHash = sha256Hex(await response.text());
    if (localHash !== liveHash) {
      throw new Error(
        `Hosted registry content SHA mismatch for ${url} (local ${localHash.slice(0, 12)}… vs live ${liveHash.slice(0, 12)}…)`,
      );
    }
  }
}

export async function publicRegistryIsGated(metadataFilePath = metadataPath) {
  const source = await readFile(metadataFilePath, "utf8");
  const match = source.match(/\bPUBLISH_GATED\s*=\s*(true|false)\b/);
  if (!match) {
    throw new Error(
      `Could not find a 'PUBLISH_GATED = true|false' assignment in ${metadataFilePath}. ` +
        "The live-check depends on this literal; update check-live-registry.mjs if it moved.",
    );
  }
  return match[1] === "true";
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  if ((await publicRegistryIsGated()) && process.env.DIFFGAZER_LIVE_REGISTRY_REQUIRED !== "1") {
    console.log("OK: hosted registry live check skipped while public registry commands are gated");
    process.exit(0);
  }

  await lookup("r.b4r7.dev");

  for (const endpoint of requiredEndpoints) {
    await assertHeadOk(endpoint);
  }

  if (process.env.DIFFGAZER_LIVE_REGISTRY_REQUIRED === "1") {
    await assertRegistryContentFresh();
  }

  console.log("OK: hosted registry DNS and required endpoints are live");
}
