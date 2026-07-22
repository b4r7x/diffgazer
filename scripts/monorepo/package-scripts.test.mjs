import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { ENV } from "./lib/env.mjs";

const rootPackageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf-8"),
);
const rootTurboJson = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../turbo.json", import.meta.url)), "utf-8"),
);

// The benchmark only gates latency/throughput SLOs under strict mode, so the
// CI/release chains must run `pnpm run bench` with the strict env var or
// breaches silently pass.
test("test-ci runs an active strict pnpm run bench segment", () => {
  assert.ok(
    scriptSegments(rootPackageJson.scripts["test-ci"]).includes(
      "DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run bench",
    ),
  );
});

test("release-check runs the benchmark under strict skip mode", () => {
  assert.match(
    rootPackageJson.scripts["release-check"],
    /DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run bench/,
  );
});

const RELEASE_READINESS_WORKFLOW_URL = new URL(
  "../../.github/workflows/release-readiness.yml",
  import.meta.url,
);

const RELEASE_CHECK_MIRRORED_GATES = [
  "pnpm audit --prod --audit-level=high",
  "pnpm run secret-scan",
  "pnpm run build",
  "pnpm run check:packages",
  "pnpm run registry:live-check",
];

const RELEASE_CHECK_PACK_COMMANDS = [
  "@diffgazer/add",
  "@diffgazer/ui",
  "@diffgazer/keys",
  "diffgazer",
].map((pkg) => `pnpm --filter ${pkg} pack --dry-run`);

// Active `run:` commands in jobs.verify.steps, in order — a commented-out or
// relocated command has no `run` key on that step and so is excluded here.
function activeVerifyStepRunCommands(workflowSource) {
  const workflow = parseYaml(workflowSource);
  const steps = workflow?.jobs?.verify?.steps ?? [];
  return steps.map((step) => step?.run).filter((run) => typeof run === "string");
}

// Exact `&&`-joined command segments of a package script, trimmed — so an
// echo-only decoy segment (`echo pnpm run build`) never satisfies an exact
// gate match the way a substring check on the whole script would. Scripts
// wrapped in `run-with-artifacts.sh sh -c '...'` (like `release-check`) are
// unwrapped to their inner chain first; scripts without that wrapper split
// as-is.
function scriptSegments(script) {
  const inner = script.match(/sh -c '(.*)'$/s)?.[1] ?? script;
  return inner.split("&&").map((segment) => segment.trim());
}

// CONTRIBUTING.md documents `pnpm run release-check` as the local mirror of the CI
// no-publish readiness sequence (release-readiness.yml). Pin the gates the CI verify
// job runs that were previously absent locally so a local pass cannot be a false
// readiness signal (finding F-052). Intentionally CI-only, so NOT mirrored here:
// the full-history gitleaks scan (separate job needing full git history), the CI
// dirty-tree `git status --short` guards (a local worktree is expected to be dirty;
// release-check keeps `git diff --check` for whitespace), the PR-only `changeset
// status --since=origin/main`, and the Docs E2E Playwright/Lighthouse job.
test("release-check mirrors the CI no-publish readiness gates", () => {
  const workflowSource = readFileSync(RELEASE_READINESS_WORKFLOW_URL, "utf-8");
  const verifyRunCommands = activeVerifyStepRunCommands(workflowSource);
  const releaseCheck = scriptSegments(rootPackageJson.scripts["release-check"]);

  for (const gate of RELEASE_CHECK_MIRRORED_GATES) {
    assert.ok(verifyRunCommands.includes(gate), `CI verify job missing active step: ${gate}`);
    assert.ok(releaseCheck.includes(gate), `release-check missing gate segment: ${gate}`);
  }

  for (const packCommand of RELEASE_CHECK_PACK_COMMANDS) {
    assert.ok(
      verifyRunCommands.includes(packCommand),
      `CI verify job missing active pack step: ${packCommand}`,
    );
    assert.ok(
      releaseCheck.includes(packCommand),
      `release-check missing pack dry-run segment: ${packCommand}`,
    );
  }
});

test("a commented-out verify step is not treated as an active gate", () => {
  const workflowSource = readFileSync(RELEASE_READINESS_WORKFLOW_URL, "utf-8");
  const mutated = workflowSource.replace("run: pnpm run build", "# run: pnpm run build");
  assert.ok(!activeVerifyStepRunCommands(mutated).includes("pnpm run build"));
});

test("a gate command that only runs outside jobs.verify is not treated as an active gate", () => {
  const workflowSource = readFileSync(RELEASE_READINESS_WORKFLOW_URL, "utf-8");
  const workflow = parseYaml(workflowSource);
  const buildStepIndex = workflow.jobs.verify.steps.findIndex(
    (step) => step.run === "pnpm run build",
  );
  const [buildStep] = workflow.jobs.verify.steps.splice(buildStepIndex, 1);
  workflow.jobs.e2e.steps.push(buildStep);
  const mutated = stringifyYaml(workflow);
  assert.ok(!activeVerifyStepRunCommands(mutated).includes("pnpm run build"));
});

test("an echo-only release-check segment does not satisfy the exact gate match", () => {
  const mutatedReleaseCheck = rootPackageJson.scripts["release-check"].replace(
    "pnpm run build",
    "echo pnpm run build",
  );
  assert.ok(!scriptSegments(mutatedReleaseCheck).includes("pnpm run build"));
});

// `verify` is the local dev command and runs `bench`/`smoke` non-strict, so the
// per-PR gate gets its bench/smoke strictness only from the workflow env prefix.
// Pin that prefix on the real per-PR gate so a workflow refactor can't silently
// drop SLO gating.
test("the release-readiness Verify step runs verify under strict skip mode", () => {
  const workflow = readFileSync(RELEASE_READINESS_WORKFLOW_URL, "utf-8");
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

const CHECK_BIOME_TARGETS = [
  "scripts/monorepo",
  "package.json",
  "turbo.json",
  "biome.json",
  "knip.jsonc",
  ".dependency-cruiser.cjs",
];

test("root check's first segment is the exact biome command over its current targets", () => {
  const checkScript = rootPackageJson.scripts.check;
  const checkSegments = scriptSegments(checkScript);
  assert.equal(checkSegments[0], `biome check ${CHECK_BIOME_TARGETS.join(" ")}`);
  assert.doesNotMatch(checkSegments[0], /\.md\b/);
  assert.doesNotMatch(checkSegments[0], /\.github/);
  assert.doesNotMatch(checkSegments[0], /pnpm-workspace\.yaml/);
  assert.match(checkScript, /check-deploy-runbooks\.mjs/);
  assert.doesNotMatch(checkScript, /biome lint scripts\/monorepo &&/);
});

test("central artifact preparation runs an active schema-generation segment and prepare:artifacts nests an active prepare:library-artifacts segment", () => {
  assert.ok(
    scriptSegments(rootPackageJson.scripts["prepare:library-artifacts"]).includes(
      "pnpm --filter @diffgazer/add generate:schema",
    ),
  );
  assert.ok(
    scriptSegments(rootPackageJson.scripts["prepare:artifacts"]).includes(
      "pnpm run prepare:library-artifacts",
    ),
  );
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

test("smoke runs an active diffgazer build segment before product CLI validation", () => {
  assert.equal(scriptSegments(rootPackageJson.scripts.smoke)[0], "pnpm --filter diffgazer build");
});

const NON_RELEASE_ECHO_DECOY_CASES = [
  {
    name: "test-ci",
    script: rootPackageJson.scripts["test-ci"],
    requiredSegment: "DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run bench",
  },
  {
    name: "check",
    script: rootPackageJson.scripts.check,
    requiredSegment: `biome check ${CHECK_BIOME_TARGETS.join(" ")}`,
  },
  {
    name: "prepare:library-artifacts",
    script: rootPackageJson.scripts["prepare:library-artifacts"],
    requiredSegment: "pnpm --filter @diffgazer/add generate:schema",
  },
  {
    name: "prepare:artifacts",
    script: rootPackageJson.scripts["prepare:artifacts"],
    requiredSegment: "pnpm run prepare:library-artifacts",
  },
  {
    name: "smoke",
    script: rootPackageJson.scripts.smoke,
    requiredSegment: "pnpm --filter diffgazer build",
  },
];

for (const { name, script, requiredSegment } of NON_RELEASE_ECHO_DECOY_CASES) {
  test(`an echo-only ${name} segment does not satisfy the exact gate match`, () => {
    const mutated = script.replace(requiredSegment, `echo ${requiredSegment}`);
    assert.ok(!scriptSegments(mutated).includes(requiredSegment));
  });
}
