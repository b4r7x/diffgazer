import { parse } from "yaml";
import { errorMessage } from "../lib/error-message.mjs";
import {
  CI_WORKFLOW_PATH,
  DEPLOY_WORKFLOW_PATH,
  RELEASE_WORKFLOW_PATH,
  stripExpressionDelimiters,
} from "./workflow-source.mjs";

const CHANGESET_STATUS_CONDITION = "github.event_name == 'pull_request'";

const REQUIRED_READINESS_JOB_IDS = ["history-secret-scan", "ci"];

// Both privileged workflows publish or deploy a caller-selected SHA, so both must
// prove that exact SHA passed every CI job. Each hard-codes the job
// names it requires; parse that list back out so a renamed or dropped CI job
// fails loudly instead of silently emptying the gate.
export const RECOVERY_READINESS_GATE_STEP = "Require CI success for recovery SHA";

export const READINESS_GATES = [
  {
    path: DEPLOY_WORKFLOW_PATH,
    jobId: "validate-request",
    stepName: "Require CI success for target SHA",
  },
  {
    path: RELEASE_WORKFLOW_PATH,
    jobId: "recovery",
    stepName: RECOVERY_READINESS_GATE_STEP,
  },
];

export function collectReadinessGateLinkFailures(gate, workflowSource, readinessSource) {
  let workflow;
  let readiness;
  try {
    workflow = parse(workflowSource);
    readiness = parse(readinessSource);
  } catch (error) {
    const message = errorMessage(error);
    return [`${gate.path}: failed to parse workflow YAML: ${message}`];
  }

  const gateStep = workflow?.jobs?.[gate.jobId]?.steps?.find(
    (candidate) => candidate?.name === gate.stepName,
  );
  if (typeof gateStep?.run !== "string") {
    return [`${gate.path}: ${gate.jobId} must require a successful CI run for the selected SHA`];
  }

  const gateLines = gateStep.run.split("\n");
  const expectedStart = gateLines.findIndex((line) => line.trim() === "expected_jobs=(");
  const expectedEnd = gateLines.findIndex(
    (line, index) => index > expectedStart && line.trim() === ")",
  );
  const expectedNames =
    expectedStart < 0 || expectedEnd < 0
      ? []
      : gateLines
          .slice(expectedStart + 1, expectedEnd)
          .map((line) => line.trim().match(/^"([^"]+)"$/)?.[1])
          .filter((name) => name !== undefined);
  const readinessNames = REQUIRED_READINESS_JOB_IDS.map((jobId) => readiness?.jobs?.[jobId]?.name);

  if (
    expectedNames.length !== REQUIRED_READINESS_JOB_IDS.length ||
    readinessNames.some((name) => typeof name !== "string") ||
    expectedNames.some((name, index) => name !== readinessNames[index])
  ) {
    return [`${gate.path}: CI job names must exactly match ${CI_WORKFLOW_PATH}`];
  }

  return [];
}

// A cancelled main CI run still fires `workflow_run` with `completed`, but
// release.yml admits `conclusion == 'success'` only and deploy.yml refuses any SHA
// without a successful CI run — so cancelling one silently drops the
// publication of the versions merged at that commit and strands the SHA. Push runs
// therefore need a per-commit group that a later merge cannot supersede.
const PUSH_EXCLUDED_FROM_CANCELLATION = /github\.event_name\s*!=\s*'push'/;

export function collectReadinessConcurrencyFailures(source) {
  let workflow;
  try {
    workflow = parse(source);
  } catch (error) {
    const message = errorMessage(error);
    return [`${CI_WORKFLOW_PATH}: failed to parse workflow YAML: ${message}`];
  }

  const failures = [];
  const group = workflow?.concurrency?.group;
  if (typeof group !== "string" || !group.includes("github.sha")) {
    failures.push(
      `${CI_WORKFLOW_PATH}: push runs must get a per-commit concurrency group keyed on github.sha`,
    );
  }

  const cancelInProgress = workflow?.concurrency?.["cancel-in-progress"];
  const cancelsPushRuns =
    cancelInProgress !== undefined &&
    cancelInProgress !== false &&
    !(
      typeof cancelInProgress === "string" && PUSH_EXCLUDED_FROM_CANCELLATION.test(cancelInProgress)
    );
  if (cancelsPushRuns) {
    failures.push(
      `${CI_WORKFLOW_PATH}: cancel-in-progress must exclude push events so a release-gating CI run is never cancelled`,
    );
  }

  return failures;
}

export function collectChangesetStatusGuardFailures(source) {
  let workflow;
  try {
    workflow = parse(source);
  } catch (error) {
    const message = errorMessage(error);
    return [`${CI_WORKFLOW_PATH}: failed to parse workflow YAML: ${message}`];
  }

  const step = workflow?.jobs?.ci?.steps?.find(
    (candidate) => candidate?.name === "Changeset status",
  );
  if (!step) {
    return [`${CI_WORKFLOW_PATH}: Changeset status step is missing`];
  }

  const failures = [];
  const condition = typeof step.if === "string" ? stripExpressionDelimiters(step.if) : null;
  if (condition?.replace(/\s+/g, " ") !== CHANGESET_STATUS_CONDITION) {
    failures.push(
      `${CI_WORKFLOW_PATH}: Changeset status step must use only the pull_request event guard`,
    );
  }
  if (step.run !== "pnpm changeset status --since=origin/main") {
    failures.push(
      `${CI_WORKFLOW_PATH}: Changeset status step must run the repository status command`,
    );
  }

  return failures;
}
