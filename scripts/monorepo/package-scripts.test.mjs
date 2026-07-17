import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { applyBenchmarkEnvDefaults, timeRequest } from "./benchmark-server.mjs";
import { ENV } from "./lib/env.mjs";
import { runArgv } from "./smoke-shared.mjs";

const rootPackageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf-8"),
);
const rootTurboJson = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../turbo.json", import.meta.url)), "utf-8"),
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

// CONTRIBUTING.md documents `pnpm run release-check` as the local mirror of the CI
// no-publish readiness sequence (release-readiness.yml). Pin the gates the CI verify
// job runs that were previously absent locally so a local pass cannot be a false
// readiness signal (finding F-052). Intentionally CI-only, so NOT mirrored here:
// the full-history gitleaks scan (separate job needing full git history), the CI
// dirty-tree `git status --short` guards (a local worktree is expected to be dirty;
// release-check keeps `git diff --check` for whitespace), the PR-only `changeset
// status --since=origin/main`, and the Docs E2E Playwright/Lighthouse job.
test("release-check mirrors the CI no-publish readiness gates", () => {
  const workflow = readFileSync(
    fileURLToPath(new URL("../../.github/workflows/release-readiness.yml", import.meta.url)),
    "utf-8",
  );
  const releaseCheck = rootPackageJson.scripts["release-check"];

  const mirroredGates = [
    "pnpm audit --prod --audit-level=high",
    "pnpm run secret-scan",
    "pnpm run build",
    "pnpm run check:packages",
    "pnpm run registry:live-check",
  ];

  for (const gate of mirroredGates) {
    assert.ok(workflow.includes(gate), `CI workflow missing gate: ${gate}`);
    assert.ok(releaseCheck.includes(gate), `release-check missing gate: ${gate}`);
  }

  for (const pkg of ["@diffgazer/add", "@diffgazer/ui", "@diffgazer/keys", "diffgazer"]) {
    assert.ok(
      releaseCheck.includes(`pnpm --filter ${pkg} pack --dry-run`),
      `release-check missing pack dry-run: ${pkg}`,
    );
  }
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

test("benchmark requests reject and release a connection that never ends", async () => {
  const server = createServer((_request, _response) => {});
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    await assert.rejects(
      timeRequest(`http://127.0.0.1:${address.port}`, "/never-ends", undefined, {
        timeoutMs: 100,
      }),
      /GET \/never-ends timed out after 100ms/,
    );
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

async function assertBenchmarkFailureCleanup({ runner, diagnostic }) {
  const isolatedTemp = mkdtempSync(join(tmpdir(), "dg-benchmark-cleanup-"));
  const before = new Set(readdirSync(isolatedTemp));
  const parentExitCode = process.exitCode;
  const benchmarkUrl = new URL("./benchmark-server.mjs", import.meta.url).href;
  const script = [
    `import { main } from ${JSON.stringify(benchmarkUrl)};`,
    `await main(${runner});`,
  ].join("\n");

  try {
    await assert.rejects(
      runArgv(process.execPath, ["--input-type=module", "-e", script], {
        env: { TEMP: isolatedTemp, TMP: isolatedTemp, TMPDIR: isolatedTemp },
        timeoutMs: 10_000,
      }),
      (error) => {
        assert.equal(error.exitCode, 1);
        assert.match(error.stderr, diagnostic);
        return true;
      },
    );
    const after = new Set(readdirSync(isolatedTemp));
    assert.deepEqual(after, before);
    assert.deepEqual(
      [...after].filter((entry) => entry.startsWith("diffgazer-bench-")),
      [],
    );
    assert.equal(process.exitCode, parentExitCode);
  } finally {
    rmSync(isolatedTemp, { recursive: true, force: true });
  }
}

for (const { name, runner, diagnostic } of [
  {
    name: "benchmark main cleans fixtures before a forced nonzero exit",
    runner: 'async () => ["forced functional gate"]',
    diagnostic: /Benchmark failed:\nforced functional gate/,
  },
  {
    name: "benchmark main cleans fixtures after a synchronous runner error",
    runner: '() => { throw new Error("forced sync runner failure"); }',
    diagnostic: /Error: forced sync runner failure/,
  },
  {
    name: "benchmark main cleans fixtures after a rejected runner promise",
    runner: '() => Promise.reject(new Error("forced rejected runner failure"))',
    diagnostic: /Error: forced rejected runner failure/,
  },
]) {
  test(name, () => assertBenchmarkFailureCleanup({ runner, diagnostic }));
}

test("runArgv passes shell metacharacters as literal argv", async () => {
  const literal = "x;echo injected";
  const output = await runArgv(process.execPath, [
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

test("central artifact preparation regenerates the published installer schema", () => {
  assert.match(
    rootPackageJson.scripts["prepare:library-artifacts"],
    /pnpm --filter @diffgazer\/add generate:schema/,
  );
  assert.match(rootPackageJson.scripts["prepare:artifacts"], /pnpm run prepare:library-artifacts/);
});

test("the add test cache includes the published installer schema", () => {
  assert.deepEqual(rootTurboJson.tasks["@diffgazer/add#test"].inputs, [
    "$TURBO_DEFAULT$",
    "$TURBO_ROOT$/apps/docs/public/schema/diffgazer.json",
  ]);
});

test("Keys tests wait for their package entry build", () => {
  assert.deepEqual(rootTurboJson.tasks["@diffgazer/keys#test"].dependsOn, ["build", "^build"]);
});

test("UI tests wait for their public registry build", () => {
  assert.deepEqual(rootTurboJson.tasks["@diffgazer/ui#test"].dependsOn, ["build", "^build"]);
});

test("smoke builds diffgazer before product CLI validation", () => {
  assert.match(rootPackageJson.scripts.smoke, /pnpm --filter diffgazer build/);
});
