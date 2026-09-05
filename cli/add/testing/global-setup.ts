import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..");
const generatedBundles = ["registry-bundle.json", "keys-copy-bundle.json", "keys-version.json"];

// The e2e suites spawn dist/index.js (see e2e/test-helpers.ts), so one tsup
// build here replaces a tsx transpile of the whole source graph in every child.
// The registry bundles under src/generated are regenerated only when missing:
// the unit tests read them too and have always relied on the caller (turbo's
// `@diffgazer/add#test` depends on `generate:bundles`) to keep them fresh, so a
// test run must not pay for regenerating them. Watch mode does not rebuild:
// spawned children keep running the build from startup until the watcher is
// restarted.
export function setup(): void {
  const bundlesExist = generatedBundles.every((file) =>
    existsSync(resolve(packageRoot, "src/generated", file)),
  );
  execFileSync("pnpm", ["run", "build"], {
    cwd: packageRoot,
    stdio: ["ignore", "ignore", "pipe"],
    env: bundlesExist ? { ...process.env, DIFFGAZER_SKIP_ARTIFACT_PREPARE: "1" } : process.env,
  });
}
