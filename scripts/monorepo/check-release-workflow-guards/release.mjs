import { parse } from "yaml";
import { errorMessage } from "../lib/error-message.mjs";
import { RECOVERY_READINESS_GATE_STEP } from "./readiness.mjs";
import {
  PACKAGE_GOVERNANCE_PATH,
  RELEASE_WORKFLOW_PATH,
  stripExpressionDelimiters,
} from "./workflow-source.mjs";

// The privileged release job must only run for trusted push provenance
// from this repository's main branch. Dropping any of these guards would let a
// pull_request-origin CI run reach the OIDC/npm-token release
// job, so guard each condition against silent removal.
export const REQUIRED_RELEASE_GUARDS = [
  "github.event.workflow_run.conclusion == 'success'",
  "github.event.workflow_run.event == 'push'",
  "github.event.workflow_run.head_repository.full_name == github.repository",
  "github.event.workflow_run.head_branch == 'main'",
];

export function collectReleaseGuardFailures(source) {
  let workflow;
  try {
    workflow = parse(source);
  } catch (error) {
    const message = errorMessage(error);
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

const CHANGESETS_ACTION = "changesets/action@63a615b9cd06ba9a3e6d13796c7fbcb080a60a0b";

const CHROMIUM_INSTALL_STEP = "Install Chromium";
const CHROMIUM_INSTALL_COMMAND =
  "pnpm --filter @diffgazer/web exec playwright install --with-deps chromium";
const GIT_CREDENTIALS_STEP = "Configure ephemeral git credentials for changesets";
const GIT_CREDENTIALS_TEARDOWN_STEP = "Remove ephemeral git credentials";
const GIT_CREDENTIALS_TEARDOWN_COMMAND =
  "git config --unset-all http.https://github.com/.extraheader";
const READINESS_STEP = "Release readiness gate";

export function collectReleaseChangesetsFailures(source) {
  let workflow;
  try {
    workflow = parse(source);
  } catch (error) {
    const message = errorMessage(error);
    return [`${RELEASE_WORKFLOW_PATH}: failed to parse workflow YAML: ${message}`];
  }

  const failures = [];
  const jobs = [
    ["release", "Checkout", "Version PR or publish"],
    ["recovery", "Checkout selected recovery commit", "Recover version metadata or publish"],
  ];

  for (const [jobName, checkoutName, changesetsName] of jobs) {
    const steps = Array.isArray(workflow?.jobs?.[jobName]?.steps)
      ? workflow.jobs[jobName].steps
      : [];
    const stepIndex = (name) => steps.findIndex((candidate) => candidate?.name === name);
    const checkout = steps.find((candidate) => candidate?.name === checkoutName);
    const chromium = steps.find((candidate) => candidate?.name === CHROMIUM_INSTALL_STEP);
    const gitCredentials = steps.find((candidate) => candidate?.name === GIT_CREDENTIALS_STEP);
    const teardown = steps.find((candidate) => candidate?.name === GIT_CREDENTIALS_TEARDOWN_STEP);
    const changesets = steps.find((candidate) => candidate?.name === changesetsName);

    // Checkout leaves no ambient push credential. Ephemeral credentials are
    // configured only for the changesets step so version commits and release tags target
    // the checked-out HEAD (workflow_run.head_sha / release_sha), not GITHUB_SHA.
    if (checkout?.with?.["persist-credentials"] !== false) {
      failures.push(
        `${RELEASE_WORKFLOW_PATH}: ${jobName} checkout must set persist-credentials: false`,
      );
    }
    if (chromium?.run?.trim() !== CHROMIUM_INSTALL_COMMAND) {
      failures.push(
        `${RELEASE_WORKFLOW_PATH}: ${jobName} must install Chromium for the release readiness gate`,
      );
    }
    const chromiumIndex = stepIndex(CHROMIUM_INSTALL_STEP);
    const readinessIndex = stepIndex(READINESS_STEP);
    const gitCredentialsIndex = stepIndex(GIT_CREDENTIALS_STEP);
    const changesetsIndex = stepIndex(changesetsName);
    if (chromiumIndex < 0 || readinessIndex < 0 || chromiumIndex >= readinessIndex) {
      failures.push(
        `${RELEASE_WORKFLOW_PATH}: ${jobName} must install Chromium before the release readiness gate`,
      );
    }
    const gitCredentialsRun = typeof gitCredentials?.run === "string" ? gitCredentials.run : "";
    if (
      !gitCredentialsRun.includes("x-access-token") ||
      !gitCredentialsRun.includes("git remote set-url")
    ) {
      failures.push(
        `${RELEASE_WORKFLOW_PATH}: ${jobName} must configure ephemeral git credentials before changesets`,
      );
    }
    if (
      gitCredentialsIndex < 0 ||
      readinessIndex < 0 ||
      changesetsIndex < 0 ||
      gitCredentialsIndex <= readinessIndex ||
      gitCredentialsIndex >= changesetsIndex
    ) {
      failures.push(
        `${RELEASE_WORKFLOW_PATH}: ${jobName} ephemeral git credentials must run after readiness and before changesets`,
      );
    }
    // A hand-written auth header gets no post-job unset from actions/checkout, so
    // the teardown is the only thing that keeps the token from outliving the step
    // that needed it — including when changesets fails, hence `if: always()`.
    const teardownRun = typeof teardown?.run === "string" ? teardown.run : "";
    if (!teardownRun.includes(GIT_CREDENTIALS_TEARDOWN_COMMAND) || teardown?.if !== "always()") {
      failures.push(
        `${RELEASE_WORKFLOW_PATH}: ${jobName} must always unset the ephemeral git credential header`,
      );
    }
    const teardownIndex = stepIndex(GIT_CREDENTIALS_TEARDOWN_STEP);
    if (teardownIndex < 0 || changesetsIndex < 0 || teardownIndex <= changesetsIndex) {
      failures.push(
        `${RELEASE_WORKFLOW_PATH}: ${jobName} must remove ephemeral git credentials after changesets`,
      );
    }
    if (changesets?.uses !== CHANGESETS_ACTION) {
      failures.push(`${RELEASE_WORKFLOW_PATH}: ${jobName} must use the pinned changesets/action`);
    }
    if (changesets?.with?.commitMode === "github-api") {
      failures.push(
        `${RELEASE_WORKFLOW_PATH}: ${jobName} must not set commitMode: github-api (version commits and tags must target checked-out HEAD, not GITHUB_SHA)`,
      );
    }
  }

  return failures;
}

export function collectReleaseRecoveryFailures(workflowSource, governanceSource) {
  let workflow;
  try {
    workflow = parse(workflowSource);
  } catch (error) {
    const message = errorMessage(error);
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
  // Recovery reads the CI run for the selected SHA through the API;
  // job-level permissions replace the workflow default, so this scope is required.
  if (job?.permissions?.actions !== "read") {
    failures.push(
      `${RELEASE_WORKFLOW_PATH}: recovery job must retain actions: read to verify release readiness`,
    );
  }

  const steps = Array.isArray(job?.steps) ? job.steps : [];
  const step = (name) => steps.find((candidate) => candidate?.name === name);
  const mainBranch = step("Require main branch");
  const format = step("Validate recovery SHA format");
  const checkout = step("Checkout selected recovery commit");
  const ancestry = step("Verify selected commit is merged into main");
  const readinessGate = step(RECOVERY_READINESS_GATE_STEP);
  const setup = step("Setup repo");
  const readiness = step("Release readiness gate");
  const publish = step("Recover version metadata or publish");

  // The dispatched ref decides which copy of these steps runs, so an npm-token- and
  // OIDC-bearing job must refuse any ref but main, exactly as deploy.yml does for its
  // privileged manual trigger. The input SHA guards below constrain what is published,
  // not the definition that publishes it.
  if (
    typeof mainBranch?.run !== "string" ||
    !mainBranch.run.includes('"${RELEASE_REF}" != "refs/heads/main"') ||
    mainBranch?.env?.RELEASE_REF !== "${{ github.ref }}"
  ) {
    failures.push(
      `${RELEASE_WORKFLOW_PATH}: recovery must refuse to run from a ref other than refs/heads/main`,
    );
  }
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
    checkout?.with?.["fetch-depth"] !== 0
  ) {
    failures.push(
      `${RELEASE_WORKFLOW_PATH}: recovery checkout must use the selected immutable SHA`,
    );
  }
  // persist-credentials: false and ephemeral git credentials are enforced in
  // collectReleaseChangesetsFailures — checkout leaves no ambient push credential.
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

  const orderedSteps = [
    mainBranch,
    format,
    checkout,
    ancestry,
    readinessGate,
    setup,
    readiness,
    publish,
  ];
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
  // The publish command is compared against the normal job's rather than pinned to
  // a literal: the two must stay identical, and the command grows package names as
  // the first-publish gate opens (PACKAGE_GOVERNANCE.md, Release Process).
  const normalPublish = (
    Array.isArray(workflow?.jobs?.release?.steps) ? workflow.jobs.release.steps : []
  ).find((candidate) => candidate?.name === "Version PR or publish")?.with?.publish;
  if (
    publish?.uses !== "changesets/action@63a615b9cd06ba9a3e6d13796c7fbcb080a60a0b" ||
    typeof normalPublish !== "string" ||
    !/^pnpm run release(?: \S+)*$/.test(normalPublish) ||
    publish?.with?.publish !== normalPublish ||
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
