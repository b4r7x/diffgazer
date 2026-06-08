import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "../..");
const metadataPath = resolve(root, "apps/docs/src/lib/consumption-metadata.ts");
const localRegistryPath = resolve(root, "libs/ui/public/r/registry.json");

export const requiredEndpoints = [
  "https://r.b4r7.dev/r/ui/registry.json",
  "https://r.b4r7.dev/r/ui/button.json",
  "https://r.b4r7.dev/r/keys/navigation.json",
];

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
  const localBody = await readFile(localRegistryPath, "utf8");
  const localHash = sha256Hex(localBody);
  const liveUrl = "https://r.b4r7.dev/r/ui/registry.json";
  const response = await fetchImpl(liveUrl, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error(`${liveUrl} returned ${response.status}`);
  }
  const liveHash = sha256Hex(await response.text());
  if (localHash !== liveHash) {
    throw new Error(
      `Hosted registry content SHA mismatch (local ${localHash.slice(0, 12)}… vs live ${liveHash.slice(0, 12)}…)`,
    );
  }
}

async function publicRegistryIsGated() {
  const source = await readFile(metadataPath, "utf8");
  return /\bPUBLISH_GATED\s*=\s*true\b/.test(source);
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
