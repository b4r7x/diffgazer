import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ENV } from "./artifacts/env.mjs";

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
