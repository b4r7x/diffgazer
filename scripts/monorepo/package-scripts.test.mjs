import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { applyBenchmarkEnvDefaults } from "./benchmark-server.mjs";
import { ENV } from "./lib/env.mjs";
import { runArgv } from "./smoke-shared.mjs";

const rootPackageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf-8"),
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
  const unsetEnv = {};
  const presetEnv = { DIFFGAZER_LOG_LEVEL: "debug" };

  applyBenchmarkEnvDefaults(unsetEnv);
  applyBenchmarkEnvDefaults(presetEnv);

  assert.equal(unsetEnv.DIFFGAZER_LOG_LEVEL, "warn");
  assert.equal(presetEnv.DIFFGAZER_LOG_LEVEL, "debug");
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

test("root check's biome segment excludes markdown, .github, and pnpm-workspace.yaml", () => {
  const checkScript = rootPackageJson.scripts.check;
  const biomeSegment = checkScript.split("&&")[0];
  assert.match(checkScript, /biome check/);
  assert.doesNotMatch(biomeSegment, /\.md\b/);
  assert.doesNotMatch(biomeSegment, /\.github/);
  assert.doesNotMatch(biomeSegment, /pnpm-workspace\.yaml/);
  assert.match(biomeSegment, /scripts\/monorepo/);
  assert.match(biomeSegment, /package\.json/);
  assert.match(biomeSegment, /turbo\.json/);
  assert.match(biomeSegment, /biome\.json/);
  assert.match(biomeSegment, /knip\.jsonc/);
  assert.match(biomeSegment, /\.dependency-cruiser\.cjs/);
  assert.match(checkScript, /check-deploy-runbooks\.mjs/);
  assert.doesNotMatch(checkScript, /biome lint scripts\/monorepo &&/);
});

test("smoke builds diffgazer before product CLI validation", () => {
  assert.match(rootPackageJson.scripts.smoke, /pnpm --filter diffgazer build/);
});
