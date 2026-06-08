import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ENV } from "./artifacts/env.mjs";
import { runArgv } from "./smoke-shared.mjs";

const rootPackageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf-8"),
);
const benchmarkScript = readFileSync(
  fileURLToPath(new URL("./benchmark-server.mjs", import.meta.url)),
  "utf-8",
);
const checkInvariantsScript = readFileSync(
  fileURLToPath(new URL("./check-invariants.mjs", import.meta.url)),
  "utf-8",
);
const smokeCliScript = readFileSync(
  fileURLToPath(new URL("./smoke-cli.mjs", import.meta.url)),
  "utf-8",
);
const smokeSharedScript = readFileSync(
  fileURLToPath(new URL("./smoke-shared.mjs", import.meta.url)),
  "utf-8",
);

// The benchmark only gates latency/throughput SLOs under strict mode, so the
// CI/release chains must run `pnpm run bench` with the strict env var or
// breaches silently pass.
test("test-ci runs the benchmark under strict skip mode", () => {
  assert.match(rootPackageJson.scripts["test-ci"], /DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run bench/);
});

test("release-check runs the benchmark under strict skip mode", () => {
  assert.match(
    rootPackageJson.scripts["release-check"],
    /DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run bench/,
  );
});

// `verify` is the local dev command and runs `bench`/`smoke` non-strict, so the
// per-PR gate gets its bench/smoke strictness only from the workflow env prefix.
// Pin that prefix on the real per-PR gate so a workflow refactor can't silently
// drop SLO gating.
test("the release-readiness Verify step runs verify under strict skip mode", () => {
  const workflow = readFileSync(
    fileURLToPath(new URL("../../.github/workflows/release-readiness.yml", import.meta.url)),
    "utf-8",
  );
  assert.match(workflow, /DIFFGAZER_SMOKE_STRICT_SKIPS=1[^\n]*pnpm run verify/);
});

// The dead review opt-in contract was removed; no script env name should
// reintroduce it.
test("the benchmark review opt-in env var is not part of the script env contract", () => {
  assert.equal(ENV.benchReviewPipeline, undefined);
  for (const value of Object.values(ENV)) {
    assert.notEqual(value, "DIFFGAZER_BENCH_REVIEW");
  }
});

test("benchmark-server defaults request logging to warn unless explicitly overridden", () => {
  assert.match(
    benchmarkScript,
    /if \(!process\.env\.DIFFGAZER_LOG_LEVEL\) {\s*process\.env\.DIFFGAZER_LOG_LEVEL = "warn";\s*}/,
  );
});

test("secret scan includes committed public registry contracts", () => {
  const secretScanScript = readFileSync(
    fileURLToPath(new URL("./secret-scan.mjs", import.meta.url)),
    "utf-8",
  );
  assert.doesNotMatch(secretScanScript, /libs\/ui\/public\/r\//);
  assert.doesNotMatch(secretScanScript, /libs\/keys\/public\/r\//);
});

test("verify:monorepo does not depend on undeclared rg", () => {
  assert.doesNotMatch(checkInvariantsScript, /\brg\b/);
  assert.match(checkInvariantsScript, /listPackageJsonFiles/);
  assert.match(checkInvariantsScript, /git.*ls-files/);
});

test("smoke scripts execute argv without a shell", () => {
  assert.doesNotMatch(smokeSharedScript, /shell:\s*true/);
  assert.match(smokeSharedScript, /execFileSync/);
  assert.doesNotMatch(smokeCliScript, /optionalPath/);
});

test("runArgv passes shell metacharacters as literal argv", () => {
  const literal = "x;echo injected";
  const output = runArgv(process.execPath, [
    "-e",
    "console.log(JSON.stringify(process.argv.at(-1)))",
    literal,
  ]);
  assert.equal(output.trim(), JSON.stringify(literal));
});

test("root check covers workflows, docs, and config files", () => {
  const checkScript = rootPackageJson.scripts.check;
  assert.match(checkScript, /biome check/);
  assert.match(checkScript, /\.github/);
  assert.match(checkScript, /README\.md/);
  assert.match(checkScript, /package\.json/);
  assert.match(checkScript, /turbo\.json/);
  assert.doesNotMatch(checkScript, /biome lint scripts\/monorepo &&/);
});

test("smoke builds diffgazer before product CLI validation", () => {
  assert.match(rootPackageJson.scripts.smoke, /pnpm --filter diffgazer build/);
  assert.match(smokeCliScript, /diffgazer CLI not built/);
  assert.doesNotMatch(smokeCliScript, /optionalPath/);
  assert.doesNotMatch(smokeCliScript, /SKIP:.*not built/);
});
