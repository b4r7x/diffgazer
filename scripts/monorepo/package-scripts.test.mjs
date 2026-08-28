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
const knipConfigSource = readFileSync(
  fileURLToPath(new URL("../../knip.jsonc", import.meta.url)),
  "utf-8",
);

// The benchmark only gates latency/throughput SLOs under strict mode, so the
// CI/release chains must run `pnpm run bench` with the strict env var or
// breaches silently pass. `release-check` pins the same segment through
// RELEASE_CHECK_NON_OPTIONAL_SEGMENTS below.
const STRICT_BENCH_COMMAND = "DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run bench";

// Turbo's default (`--continue=never`) cancels every remaining task on the first
// failure, so one red package tears down the others mid-run and the log carries no
// verdict for them at all — anyone sizing a fix wave from that run under-counts.
// `dependencies-successful` lets every package whose dependencies built report its
// own result while still skipping tasks whose dependencies failed; Turbo still
// exits with the highest exit code, so the gate stays red.
const TURBO_TEST_COMMAND = "turbo run test --continue=dependencies-successful";

test("test-ci delegates verify under strict skip mode", () => {
  assert.equal(
    rootPackageJson.scripts["test-ci"],
    "DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run verify",
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
  "pnpm run check:changesets",
];

const RELEASE_CHECK_PACK_COMMANDS = [
  "@diffgazer/add",
  "@diffgazer/ui",
  "@diffgazer/keys",
  "diffgazer",
].map((pkg) => `pnpm --filter ${pkg} pack --dry-run`);

const T105_PROVIDER_PLAYWRIGHT_COMMAND =
  "pnpm --filter @diffgazer/web exec playwright test testing/e2e/providers.e2e.ts --project=chromium --project=mobile-chromium";

const DOCS_BUILD_COMMAND = "pnpm --filter @diffgazer/docs build";

const LEGACY_ALLOWLIST_COMMAND =
  "node --test scripts/monorepo/provider-transport-legacy-allowlist.test.mjs";

// Non-optional release gates in command order — a commented-out or echo-only
// segment must not satisfy these exact matches.
const RELEASE_CHECK_NON_OPTIONAL_SEGMENTS = [
  "pnpm run secret-scan",
  "pnpm run validate:artifacts:check",
  "pnpm run check",
  "pnpm run test:scripts",
  "turbo run type-check",
  TURBO_TEST_COMMAND,
  "turbo run test:types",
  "DIFFGAZER_SMOKE_STRICT_SKIPS=1 pnpm run smoke",
  T105_PROVIDER_PLAYWRIGHT_COMMAND,
  DOCS_BUILD_COMMAND,
  STRICT_BENCH_COMMAND,
  "pnpm run check:changesets",
  "pnpm run verify:monorepo",
  LEGACY_ALLOWLIST_COMMAND,
  "git diff --check",
];

// Active `run:` commands in jobs.verify.steps, in order — a commented-out or
// relocated command has no `run` key on that step and so is excluded here.
function activeVerifyStepRunCommands(workflowSource) {
  const workflow = parseYaml(workflowSource);
  const steps = workflow?.jobs?.verify?.steps ?? [];
  return steps.map((step) => step?.run).filter((run) => typeof run === "string");
}

function activeE2eStepRunCommands(workflowSource) {
  const workflow = parseYaml(workflowSource);
  const steps = workflow?.jobs?.e2e?.steps ?? [];
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

test("script segments split on `&&`, trim, and unwrap an `sh -c` chain", () => {
  assert.deepEqual(scriptSegments("a && echo b"), ["a", "echo b"]);
  assert.deepEqual(scriptSegments("run-with-artifacts.sh sh -c 'a && b'"), ["a", "b"]);
});

// CONTRIBUTING.md documents `pnpm run release-check` as the local mirror of the CI
// no-publish readiness sequence (release-readiness.yml). Pin the gates the CI verify
// job runs that were previously absent locally so a local pass cannot be a false
// readiness signal. Intentionally CI-only, so NOT mirrored here:
// the event-range Gitleaks scan (separate action job; fetch-depth does not make it
// a full-history scan), the CI
// dirty-tree `git status --short` guards (a local worktree is expected to be dirty;
// release-check keeps `git diff --check` for whitespace), the PR-only `changeset
// status --since=origin/main`, and the Docs E2E Playwright/Lighthouse job.
test("release-check runs non-optional release gates in command order", () => {
  const releaseCheck = scriptSegments(rootPackageJson.scripts["release-check"]);
  let lastIndex = -1;
  for (const segment of RELEASE_CHECK_NON_OPTIONAL_SEGMENTS) {
    const index = releaseCheck.indexOf(segment);
    assert.ok(index > lastIndex, `release-check segment out of order or missing: ${segment}`);
    lastIndex = index;
  }
});

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

// `verify` is the local dev command and runs `bench`/`smoke` non-strict, so the
// per-PR gate gets its bench/smoke strictness only from the workflow env prefix.
// Pin that prefix on the active `run` of the real per-PR gate step so a workflow
// refactor can't silently drop SLO gating: raw workflow text keeps matching when
// the strictness moves into a comment or into another job.
function verifyJobStepRun(workflowSource, stepName) {
  const workflow = parseYaml(workflowSource);
  const steps = workflow?.jobs?.verify?.steps ?? [];
  return steps.find((step) => step?.name === stepName)?.run;
}

const STRICT_VERIFY_RUN = /(?:^|\s)DIFFGAZER_SMOKE_STRICT_SKIPS=1\s[^\n]*pnpm run verify$/;

test("the release-readiness Verify step runs verify under strict skip mode", () => {
  const workflowSource = readFileSync(RELEASE_READINESS_WORKFLOW_URL, "utf-8");
  const verifyRun = verifyJobStepRun(workflowSource, "Verify");

  assert.equal(typeof verifyRun, "string", "jobs.verify has no active Verify step");
  assert.match(verifyRun, STRICT_VERIFY_RUN);
});

test("a strictness prefix left in a comment does not satisfy the Verify gate", () => {
  const workflowSource = readFileSync(RELEASE_READINESS_WORKFLOW_URL, "utf-8");
  const activeRun = verifyJobStepRun(workflowSource, "Verify");
  const mutated = workflowSource.replace(
    `run: ${activeRun}`,
    `run: pnpm run verify\n        # run: ${activeRun}`,
  );

  assert.equal(verifyJobStepRun(mutated, "Verify"), "pnpm run verify");
  assert.doesNotMatch(verifyJobStepRun(mutated, "Verify"), STRICT_VERIFY_RUN);
  // The demoted command still carries the strict text as raw workflow bytes.
  assert.match(mutated, /DIFFGAZER_SMOKE_STRICT_SKIPS=1[^\n]*pnpm run verify/);
});

test("a strict verify step relocated out of jobs.verify is not the active gate", () => {
  const workflow = parseYaml(readFileSync(RELEASE_READINESS_WORKFLOW_URL, "utf-8"));
  const verifyStepIndex = workflow.jobs.verify.steps.findIndex((step) => step.name === "Verify");
  const [verifyStep] = workflow.jobs.verify.steps.splice(verifyStepIndex, 1);
  workflow.jobs.e2e.steps.push(verifyStep);
  const mutated = stringifyYaml(workflow);

  assert.equal(verifyJobStepRun(mutated, "Verify"), undefined);
  assert.equal(activeE2eStepRunCommands(mutated).includes(verifyStep.run), true);
});

test("release-readiness workflow runs legacy allowlist and git whitespace gates", () => {
  const workflowSource = readFileSync(RELEASE_READINESS_WORKFLOW_URL, "utf-8");
  const verifyRunCommands = activeVerifyStepRunCommands(workflowSource);
  assert.ok(
    verifyRunCommands.includes(LEGACY_ALLOWLIST_COMMAND),
    "CI verify job missing legacy allowlist step",
  );
  assert.ok(
    verifyRunCommands.includes("git diff --check"),
    "CI verify job missing git diff --check step",
  );
});

test("release-readiness e2e job runs provider Playwright and docs build gates", () => {
  const workflowSource = readFileSync(RELEASE_READINESS_WORKFLOW_URL, "utf-8");
  const e2eRunCommands = activeE2eStepRunCommands(workflowSource);
  assert.ok(
    e2eRunCommands.includes(T105_PROVIDER_PLAYWRIGHT_COMMAND),
    "CI e2e job missing T-105 provider Playwright step",
  );
  assert.ok(e2eRunCommands.includes(DOCS_BUILD_COMMAND), "CI e2e job missing docs build step");
  const providerIndex = e2eRunCommands.indexOf(T105_PROVIDER_PLAYWRIGHT_COMMAND);
  const docsBuildIndex = e2eRunCommands.indexOf(DOCS_BUILD_COMMAND);
  assert.ok(providerIndex > docsBuildIndex, "provider Playwright must run after docs build");
});

// The dead review opt-in contract was removed; no script env name should
// reintroduce it.
test("the benchmark review opt-in env var is not part of the script env contract", () => {
  for (const value of Object.values(ENV)) {
    assert.notEqual(value, "DIFFGAZER_BENCH_REVIEW");
  }
});

test("every root chain runs the workspace test task so one red package cannot silence the rest", () => {
  const chains = Object.entries(rootPackageJson.scripts).filter(([, script]) =>
    /turbo run test(?![:\w-])/.test(script),
  );
  assert.deepEqual(
    chains.map(([name]) => name),
    ["test", "verify", "release-check"],
    "a new chain running the workspace test task must adopt the same continue behaviour",
  );
  for (const [name, script] of chains) {
    assert.ok(
      script.includes(TURBO_TEST_COMMAND),
      `${name} runs the workspace test task without ${TURBO_TEST_COMMAND}`,
    );
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

test("Knip treats configuration hints as errors in both direct and root-script runs", () => {
  assert.equal(rootPackageJson.scripts.knip, "knip --treat-config-hints-as-errors");
  assert.match(knipConfigSource, /["']treatConfigHintsAsErrors["']\s*:\s*true/);
});

const VERSION_PACKAGES_TRACKED_BUILD_OUTPUTS = ["pnpm --filter diffgazer build:notices"];

test("version-packages regenerates tracked diffgazer build outputs", () => {
  const segments = scriptSegments(rootPackageJson.scripts["version-packages"]);
  for (const segment of VERSION_PACKAGES_TRACKED_BUILD_OUTPUTS) {
    assert.ok(
      segments.includes(segment),
      `version-packages missing tracked build-output segment: ${segment}`,
    );
  }
  assert.ok(
    segments.includes("pnpm --filter diffgazer build:bundle"),
    "version-packages must bundle diffgazer before regenerating THIRD_PARTY_NOTICES",
  );
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

// A direct `pnpm --filter <pkg> build` leaves no Turbo task record, so the root
// `turbo run build` rebuilds the same pipelines; going through Turbo makes the
// second pass a cache hit.
const PREPARED_LIBRARY_BUILD_SEGMENT =
  "turbo run build --filter=@diffgazer/registry --filter=@diffgazer/keys --filter=@diffgazer/ui";

test("library artifact preparation builds packages through Turbo, never outside it", () => {
  const segments = scriptSegments(rootPackageJson.scripts["prepare:library-artifacts"]);
  assert.ok(
    segments.includes(PREPARED_LIBRARY_BUILD_SEGMENT),
    "prepare:library-artifacts must build library packages through Turbo",
  );
  assert.deepEqual(
    segments.filter((segment) => /^pnpm --filter \S+ build$/.test(segment)),
    [],
    "a direct package build seeds no Turbo record and is rebuilt by the root build graph",
  );
  assert.ok(
    !segments.some((segment) => segment.includes("@diffgazer/keys-artifacts")),
    "the parent Keys build owns the mirror output; the private mirror has no duplicate task",
  );
  assert.equal(
    rootTurboJson.tasks["@diffgazer/keys-artifacts#build"],
    undefined,
    "keys-artifacts must not grow a second writer task",
  );
  assert.ok(
    rootTurboJson.tasks["@diffgazer/keys#build"].outputs.includes("artifacts/artifacts/**"),
    "the parent Keys task must declare the mirror output it writes",
  );
});

test("no root chain re-builds a package its own preparation step already built", () => {
  for (const [name, script] of Object.entries(rootPackageJson.scripts)) {
    const segments = scriptSegments(script);
    if (!segments.includes("pnpm run prepare:library-artifacts")) continue;
    assert.deepEqual(
      segments.filter((segment) => /^pnpm --filter \S+ build$/.test(segment)),
      [],
      `${name} re-builds a package outside Turbo after preparation already built it`,
    );
  }
});

test("the root build hands the prepared packages to a single Turbo build graph", () => {
  const segments = scriptSegments(rootPackageJson.scripts.build);
  assert.match(
    segments[0],
    /^if \[ "\$DIFFGAZER_SKIP_ARTIFACT_PREPARE" != "1" \]; then pnpm run prepare:artifacts; fi$/,
  );
  assert.equal(segments[1], "DIFFGAZER_SKIP_ARTIFACT_PREPARE=1 pnpm exec turbo run build");
});

// `prepack` fires on every pack, not only on publish — smoke's tarball install,
// `attw --pack`, and the release-check dry-runs all reach it — so it owns the
// build alone and the package gates live on the publish-only hook. Both diffgazer gates run from source (`tsc --noEmit`,
// vitest against `src/`), so they do not need the packed `dist`.
const diffgazerPackageJson = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../cli/diffgazer/package.json", import.meta.url)),
    "utf-8",
  ),
);
const addPackageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../cli/add/package.json", import.meta.url)), "utf-8"),
);

const PUBLISH_LIFECYCLE_HOOKS = ["prepublishOnly", "prepack", "prepare"];

test("diffgazer runs its package build once across the publish lifecycle hooks", () => {
  const segments = PUBLISH_LIFECYCLE_HOOKS.map((hook) => diffgazerPackageJson.scripts[hook])
    .filter((script) => typeof script === "string")
    .flatMap(scriptSegments);
  assert.deepEqual(
    segments.filter((segment) => segment === "pnpm run build"),
    ["pnpm run build"],
  );
});

test("packing diffgazer builds the dist without re-running its package gates", () => {
  const prepack = scriptSegments(diffgazerPackageJson.scripts.prepack);
  assert.ok(prepack.includes("pnpm run build"), "prepack must build the packed dist");
  assert.deepEqual(
    prepack.filter((segment) => segment === "pnpm run type-check" || segment === "pnpm run test"),
    [],
    "prepack runs on every pack, so a gate here re-runs the suite for smoke, attw, and dry-runs",
  );
});

test("publishing diffgazer runs its package gates", () => {
  assert.deepEqual(scriptSegments(diffgazerPackageJson.scripts.prepublishOnly), [
    "pnpm run type-check",
    "pnpm run test",
  ]);
});

test("Add builds once in prepack and keeps prepublishOnly validation-only", () => {
  const segments = [addPackageJson.scripts.prepublishOnly, addPackageJson.scripts.prepack].flatMap(
    scriptSegments,
  );
  assert.deepEqual(
    segments.filter((segment) => segment === "pnpm run build"),
    ["pnpm run build"],
  );
  assert.equal(
    scriptSegments(addPackageJson.scripts.prepublishOnly).includes("pnpm run build"),
    false,
  );
  // The artifact gate leads because it also prepares what the other two read:
  // `type-check` resolves the workspace packages through their built dist and
  // `test` loads the gitignored src/generated/. prepack, the only hook that
  // builds, does not run until prepublishOnly has already passed.
  assert.deepEqual(scriptSegments(addPackageJson.scripts.prepublishOnly), [
    "pnpm run validate:artifacts",
    "pnpm run type-check",
    "pnpm run test",
  ]);
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

test("UI browser tests wait for the package entry they server-render", () => {
  // testing/e2e/listbox-active-descendant.e2e.ts imports @diffgazer/ui through the
  // package self-reference, which resolves to the gitignored dist. Without this
  // edge the suite asserts against whatever build happens to be on disk.
  assert.deepEqual(rootTurboJson.tasks["@diffgazer/ui#test:e2e"].dependsOn, ["build"]);
  assert.equal(rootTurboJson.tasks["@diffgazer/ui#test:e2e"].cache, false);
});

test("the CI e2e job builds UI before running its browser suite", () => {
  // The CI step runs Playwright directly, so the task-graph edge above never
  // applies there: the ordering in the job is what keeps the suite honest.
  const workflowSource = readFileSync(RELEASE_READINESS_WORKFLOW_URL, "utf-8");
  const e2eRunCommands = activeE2eStepRunCommands(workflowSource);
  const buildIndex = e2eRunCommands.indexOf("pnpm --filter @diffgazer/ui build");
  const suiteIndex = e2eRunCommands.indexOf("pnpm --filter @diffgazer/ui test:e2e");

  assert.ok(buildIndex >= 0, "CI e2e job missing UI build step");
  assert.ok(suiteIndex > buildIndex, "UI Playwright suite must run after the UI build");
});

test("smoke runs an active diffgazer build segment before product CLI validation", () => {
  assert.equal(scriptSegments(rootPackageJson.scripts.smoke)[0], "pnpm --filter diffgazer build");
});
