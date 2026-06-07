import { lookup } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const metadataPath = resolve(root, "apps/docs/src/lib/consumption-metadata.ts");
const requiredEndpoints = [
  "https://r.b4r7.dev/r/ui/registry.json",
  "https://r.b4r7.dev/r/ui/button.json",
  "https://r.b4r7.dev/r/keys/navigation.json",
];

async function publicRegistryIsGated() {
  const source = await readFile(metadataPath, "utf8");
  return /\bPUBLISH_GATED\s*=\s*true\b/.test(source);
}

async function assertHeadOk(url) {
  const response = await fetch(url, {
    method: "HEAD",
    signal: AbortSignal.timeout(10_000),
  });

  if (response.status !== 200) {
    throw new Error(`${url} returned ${response.status}`);
  }
}

if ((await publicRegistryIsGated()) && process.env.DIFFGAZER_LIVE_REGISTRY_REQUIRED !== "1") {
  console.log("OK: hosted registry live check skipped while public registry commands are gated");
  process.exit(0);
}

await lookup("r.b4r7.dev");

for (const endpoint of requiredEndpoints) {
  await assertHeadOk(endpoint);
}

console.log("OK: hosted registry DNS and required endpoints are live");
