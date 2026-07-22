import { parse } from "yaml";
import { DEPLOY_WORKFLOW_PATH, RELEASE_READINESS_WORKFLOW_PATH } from "./workflow-source.mjs";
import { REQUIRED_READINESS_JOB_IDS } from "./readiness.mjs";

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
