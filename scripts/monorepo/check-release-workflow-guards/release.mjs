import { parse } from "yaml";
import {
  PACKAGE_GOVERNANCE_PATH,
  RELEASE_WORKFLOW_PATH,
  stripExpressionDelimiters,
} from "./workflow-source.mjs";

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
