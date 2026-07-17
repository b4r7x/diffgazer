#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { runValidationChecks } from "./lib/run-checks.mjs";

export const RELEASE_WORKFLOW_PATH = ".github/workflows/release.yml";
export const RELEASE_READINESS_WORKFLOW_PATH = ".github/workflows/release-readiness.yml";
export const DEPLOY_WORKFLOW_PATH = ".github/workflows/deploy.yml";
export const PACKAGE_GOVERNANCE_PATH = "PACKAGE_GOVERNANCE.md";

// F-089: the privileged release job must only run for trusted push provenance
// from this repository's main branch. Dropping any of these guards would let a
// pull_request-origin Release Readiness run reach the OIDC/npm-token release
// job, so guard each condition against silent removal.
export const REQUIRED_RELEASE_GUARDS = [
  "github.event.workflow_run.conclusion == 'success'",
  "github.event.workflow_run.event == 'push'",
  "github.event.workflow_run.head_repository.full_name == github.repository",
  "github.event.workflow_run.head_branch == 'main'",
];

export const CHANGESET_STATUS_CONDITION = [
  "github.event_name == 'pull_request'",
  "&& (github.head_ref != 'changeset-release/main'",
  "|| github.event.pull_request.head.repo.full_name != github.repository",
  "|| github.event.pull_request.user.login != 'github-actions[bot]')",
].join(" ");

export const REQUIRED_BROWSER_E2E_STEPS = [
  { name: "Run Web Playwright tests", run: "pnpm --filter @diffgazer/web test:e2e" },
  { name: "Run UI Playwright tests", run: "pnpm --filter @diffgazer/ui test:e2e" },
];

const REQUIRED_READINESS_JOB_IDS = ["history-secret-scan", "verify", "e2e"];

const stripExpressionDelimiters = (condition) =>
  condition
    .replace(/^\s*\$\{\{\s*/, "")
    .replace(/\s*\}\}\s*$/, "")
    .trim();

export function collectReleaseGuardFailures(source) {
  let workflow;
  try {
    workflow = parse(source);
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error ? error.message : String(error);
    return [`${RELEASE_WORKFLOW_PATH}: failed to parse workflow YAML: ${message}`];
  }

  const condition = workflow?.jobs?.release?.if;
  if (typeof condition !== "string") {
    return [`${RELEASE_WORKFLOW_PATH}: release job is missing an \`if\` guard`];
  }

  const normalized = stripExpressionDelimiters(condition.replace(/\s+/g, " "));
  const failures = [];

  if (normalized.includes("||")) {
    failures.push(
      `${RELEASE_WORKFLOW_PATH}: release job \`if\` must use only a positive \`&&\` conjunction`,
    );
  }

  const terms = new Set(normalized.split("&&").map((term) => term.trim()));

  failures.push(
    ...REQUIRED_RELEASE_GUARDS.filter((guard) => !terms.has(guard)).map(
      (guard) => `${RELEASE_WORKFLOW_PATH}: release job \`if\` is missing guard: ${guard}`,
    ),
  );

  return failures;
}

export function collectReleaseRecoveryFailures(workflowSource, governanceSource) {
  let workflow;
  try {
    workflow = parse(workflowSource);
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error ? error.message : String(error);
    return [`${RELEASE_WORKFLOW_PATH}: failed to parse workflow YAML: ${message}`];
  }

  const failures = [];
  const input = workflow?.on?.workflow_dispatch?.inputs?.release_sha;
  if (input?.required !== true || input?.type !== "string") {
    failures.push(
      `${RELEASE_WORKFLOW_PATH}: workflow_dispatch must require a string release_sha input`,
    );
  }

  if (workflow?.concurrency?.group !== "release") {
    failures.push(`${RELEASE_WORKFLOW_PATH}: normal and recovery publishes must share concurrency`);
  }

  const job = workflow?.jobs?.recovery;
  const condition = typeof job?.if === "string" ? stripExpressionDelimiters(job.if) : null;
  if (condition !== "github.event_name == 'workflow_dispatch'") {
    failures.push(`${RELEASE_WORKFLOW_PATH}: recovery job must be workflow_dispatch-only`);
  }
  if (job?.["runs-on"] !== "ubuntu-latest") {
    failures.push(`${RELEASE_WORKFLOW_PATH}: recovery job must use a GitHub-hosted runner`);
  }
  if (job?.environment !== "production") {
    failures.push(`${RELEASE_WORKFLOW_PATH}: recovery job must use the production environment`);
  }
  if (job?.permissions?.["id-token"] !== "write") {
    failures.push(`${RELEASE_WORKFLOW_PATH}: recovery job must retain id-token: write`);
  }

  const steps = Array.isArray(job?.steps) ? job.steps : [];
  const step = (name) => steps.find((candidate) => candidate?.name === name);
  const format = step("Validate recovery SHA format");
  const checkout = step("Checkout selected recovery commit");
  const ancestry = step("Verify selected commit is merged into main");
  const setup = step("Setup repo");
  const readiness = step("Release readiness gate");
  const publish = step("Recover version metadata or publish");

  if (
    typeof format?.run !== "string" ||
    !format.run.includes("^[0-9a-fA-F]{40}$") ||
    format?.env?.RELEASE_SHA !== "${{ inputs.release_sha }}"
  ) {
    failures.push(
      `${RELEASE_WORKFLOW_PATH}: recovery must validate a full commit SHA before checkout`,
    );
  }
  if (
    checkout?.uses !== "actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd" ||
    checkout?.with?.ref !== "${{ inputs.release_sha }}" ||
    checkout?.with?.["persist-credentials"] !== false ||
    checkout?.with?.["fetch-depth"] !== 0
  ) {
    failures.push(
      `${RELEASE_WORKFLOW_PATH}: recovery checkout must use the selected immutable SHA`,
    );
  }
  if (
    typeof ancestry?.run !== "string" ||
    !ancestry.run.includes("git merge-base --is-ancestor") ||
    !ancestry.run.includes("refs/remotes/origin/main") ||
    !ancestry.run.includes('"$selected_sha" != "${RELEASE_SHA,,}"')
  ) {
    failures.push(
      `${RELEASE_WORKFLOW_PATH}: recovery must prove the selected SHA is merged into main`,
    );
  }

  const orderedSteps = [format, checkout, ancestry, setup, readiness, publish];
  const indexes = orderedSteps.map((candidate) => steps.indexOf(candidate));
  if (
    indexes.some((index) => index < 0) ||
    indexes.some((index, i) => i > 0 && index <= indexes[i - 1])
  ) {
    failures.push(
      `${RELEASE_WORKFLOW_PATH}: recovery validation and release steps are out of order`,
    );
  }
  if (setup?.uses !== "./.github/actions/setup-repo") {
    failures.push(`${RELEASE_WORKFLOW_PATH}: recovery must use the repository setup action`);
  }
  if (readiness?.run !== "pnpm run release-check") {
    failures.push(`${RELEASE_WORKFLOW_PATH}: recovery must run the release readiness gate`);
  }
  if (
    publish?.uses !== "changesets/action@63a615b9cd06ba9a3e6d13796c7fbcb080a60a0b" ||
    publish?.with?.publish !== "pnpm run release" ||
    publish?.env?.NPM_CONFIG_PROVENANCE !== "true"
  ) {
    failures.push(`${RELEASE_WORKFLOW_PATH}: recovery must use the normal OIDC release chain`);
  }

  const recoverySection = (
    governanceSource.split("#### Recovery from publish failure")[1] ?? ""
  ).split("\n## ")[0];
  if (
    !recoverySection.includes("Recover Publish from Merged Main SHA") ||
    !recoverySection.includes("protected `production` environment")
  ) {
    failures.push(`${PACKAGE_GOVERNANCE_PATH}: recovery must name the hosted OIDC job`);
  }
  if (
    recoverySection.includes("pnpm install --frozen-lockfile") ||
    recoverySection.includes("NPM_CONFIG_PROVENANCE=true")
  ) {
    failures.push(
      `${PACKAGE_GOVERNANCE_PATH}: recovery must not prescribe local provenance publish`,
    );
  }

  return failures;
}

export function shouldRunChangesetStatus({
  eventName,
  headRef,
  headRepository,
  repository,
  pullRequestAuthor,
}) {
  if (eventName !== "pull_request") return false;
  return !(
    headRef === "changeset-release/main" &&
    headRepository === repository &&
    pullRequestAuthor === "github-actions[bot]"
  );
}

export function collectChangesetStatusGuardFailures(source) {
  let workflow;
  try {
    workflow = parse(source);
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error ? error.message : String(error);
    return [`${RELEASE_READINESS_WORKFLOW_PATH}: failed to parse workflow YAML: ${message}`];
  }

  const step = workflow?.jobs?.verify?.steps?.find(
    (candidate) => candidate?.name === "Changeset status",
  );
  if (!step) {
    return [`${RELEASE_READINESS_WORKFLOW_PATH}: Changeset status step is missing`];
  }

  const failures = [];
  const condition = typeof step.if === "string" ? stripExpressionDelimiters(step.if) : null;
  if (condition?.replace(/\s+/g, " ") !== CHANGESET_STATUS_CONDITION) {
    failures.push(
      `${RELEASE_READINESS_WORKFLOW_PATH}: Changeset status step has an unexpected identity guard`,
    );
  }
  if (step.run !== "pnpm changeset status --since=origin/main") {
    failures.push(
      `${RELEASE_READINESS_WORKFLOW_PATH}: Changeset status step must run the repository status command`,
    );
  }

  const browserSteps = workflow?.jobs?.e2e?.steps;
  for (const requirement of REQUIRED_BROWSER_E2E_STEPS) {
    const browserStep = browserSteps?.find((candidate) => candidate?.name === requirement.name);
    if (browserStep?.run !== requirement.run) {
      failures.push(
        `${RELEASE_READINESS_WORKFLOW_PATH}: ${requirement.name} must run ${requirement.run}`,
      );
    }
  }

  return failures;
}

export function collectDeployReadinessLinkFailures(deploySource, readinessSource) {
  let deploy;
  let readiness;
  try {
    deploy = parse(deploySource);
    readiness = parse(readinessSource);
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error ? error.message : String(error);
    return [`deploy/readiness workflow linkage: failed to parse YAML: ${message}`];
  }

  const gateStep = deploy?.jobs?.["validate-request"]?.steps?.find(
    (candidate) => candidate?.name === "Require Release Readiness success for target SHA",
  );
  const gateLines = typeof gateStep?.run === "string" ? gateStep.run.split("\n") : [];
  const expectedStart = gateLines.findIndex((line) => line.trim() === "expected_jobs=(");
  const expectedEnd = gateLines.findIndex(
    (line, index) => index > expectedStart && line.trim() === ")",
  );
  const expectedNames = gateLines
    .slice(expectedStart + 1, expectedEnd)
    .map((line) => line.trim().match(/^"([^"]+)"$/)?.[1])
    .filter((name) => name !== undefined);
  const readinessNames = REQUIRED_READINESS_JOB_IDS.map((jobId) => readiness?.jobs?.[jobId]?.name);

  if (
    expectedNames.length !== REQUIRED_READINESS_JOB_IDS.length ||
    readinessNames.some((name) => typeof name !== "string") ||
    expectedNames.some((name, index) => name !== readinessNames[index])
  ) {
    return [
      `${DEPLOY_WORKFLOW_PATH}: readiness job names must exactly match ${RELEASE_READINESS_WORKFLOW_PATH}`,
    ];
  }

  return [];
}

export function collectDeployTransactionFailures(source) {
  let workflow;
  try {
    workflow = parse(source);
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error ? error.message : String(error);
    return [`${DEPLOY_WORKFLOW_PATH}: failed to parse workflow YAML: ${message}`];
  }

  const step = workflow?.jobs?.["promote-deploy"]?.steps?.find(
    (candidate) => candidate?.name === "Promote scanned images and trigger Coolify",
  );
  if (typeof step?.run !== "string") {
    return [`${DEPLOY_WORKFLOW_PATH}: transactional promotion step is missing`];
  }

  const run = step.run;
  const captureIndex = run.indexOf('previous_digests["${service}"]="${digest}"');
  const trapIndex = run.indexOf("trap rollback_deployment EXIT");
  const signalTrapIndex = run.indexOf("trap 'exit 143' TERM");
  const registerIndex = run.indexOf('changed_services+=("${service}")');
  const promoteIndex = run.indexOf('promote "${selected_images[index]}"');
  const verifyIndex = run.indexOf("node scripts/monorepo/verify-deployed-source-tags.mjs");
  const firstDisarmIndex = trapIndex < 0 ? -1 : run.indexOf("trap - EXIT HUP INT TERM", trapIndex);
  const disarmIndex = run.lastIndexOf("trap - EXIT HUP INT TERM");
  const failures = [];

  if (
    captureIndex < 0 ||
    trapIndex < 0 ||
    signalTrapIndex < 0 ||
    registerIndex < 0 ||
    promoteIndex < 0 ||
    !(captureIndex < trapIndex && trapIndex < registerIndex && registerIndex < promoteIndex)
  ) {
    failures.push(
      `${DEPLOY_WORKFLOW_PATH}: production digests must be captured before the promotion transaction starts`,
    );
  }
  if (!run.includes("trap - EXIT\n") || !run.includes("trap '' HUP INT TERM")) {
    failures.push(`${DEPLOY_WORKFLOW_PATH}: rollback must be recursion-safe`);
  }
  if (!run.includes("for ((index=${#changed_services[@]} - 1; index >= 0; index--))")) {
    failures.push(
      `${DEPLOY_WORKFLOW_PATH}: rollback must restore changed services in reverse order`,
    );
  }
  if (!run.includes('"${IMAGE_OWNER}/${image}@${digest}"')) {
    failures.push(`${DEPLOY_WORKFLOW_PATH}: rollback must restore the captured immutable digest`);
  }
  if (!run.includes('trigger "${service}" "${webhook}" ""')) {
    failures.push(
      `${DEPLOY_WORKFLOW_PATH}: rollback trigger must not report an image digest as source_sha`,
    );
  }
  if (
    verifyIndex < 0 ||
    firstDisarmIndex < 0 ||
    disarmIndex < 0 ||
    trapIndex < 0 ||
    !(trapIndex < verifyIndex && verifyIndex < firstDisarmIndex && firstDisarmIndex === disarmIndex)
  ) {
    failures.push(
      `${DEPLOY_WORKFLOW_PATH}: the rollback trap must remain armed through public endpoint verification`,
    );
  }

  return failures;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runValidationChecks(
    [
      ...collectReleaseGuardFailures(readFileSync(RELEASE_WORKFLOW_PATH, "utf8")),
      ...collectReleaseRecoveryFailures(
        readFileSync(RELEASE_WORKFLOW_PATH, "utf8"),
        readFileSync(PACKAGE_GOVERNANCE_PATH, "utf8"),
      ),
      ...collectChangesetStatusGuardFailures(readFileSync(RELEASE_READINESS_WORKFLOW_PATH, "utf8")),
      ...collectDeployReadinessLinkFailures(
        readFileSync(DEPLOY_WORKFLOW_PATH, "utf8"),
        readFileSync(RELEASE_READINESS_WORKFLOW_PATH, "utf8"),
      ),
      ...collectDeployTransactionFailures(readFileSync(DEPLOY_WORKFLOW_PATH, "utf8")),
    ],
    {
      failureHeader: "Release workflow provenance guard checks failed",
      successMessage: "OK: release workflow provenance guards present",
    },
  );
}
