import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DOCS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_ROOT = resolve(DOCS_ROOT, "../..");

if (process.env.DIFFGAZER_SKIP_ARTIFACT_PREPARE !== "1") {
  execFileSync("pnpm", ["--dir", WORKSPACE_ROOT, "run", "prepare:library-artifacts"], {
    stdio: "inherit",
  });
}

await import(pathToFileURL(resolve(DOCS_ROOT, "scripts/sync-artifacts.mjs")).href);
