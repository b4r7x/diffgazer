import { parse } from "yaml";
import { RELEASE_READINESS_WORKFLOW_PATH, stripExpressionDelimiters } from "./workflow-source.mjs";

const CHANGESET_STATUS_CONDITION = [
  "github.event_name == 'pull_request'",
  "&& (github.head_ref != 'changeset-release/main'",
  "|| github.event.pull_request.head.repo.full_name != github.repository",
  "|| github.event.pull_request.user.login != 'github-actions[bot]')",
].join(" ");

export const REQUIRED_BROWSER_E2E_STEPS = [
  { name: "Run Web Playwright tests", run: "pnpm --filter @diffgazer/web test:e2e" },
  { name: "Run UI Playwright tests", run: "pnpm --filter @diffgazer/ui test:e2e" },
];

export const REQUIRED_READINESS_JOB_IDS = ["history-secret-scan", "verify", "e2e"];

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
