import { parse } from "yaml";
import { errorMessage } from "../lib/error-message.mjs";
import { SOURCE_TAG_POLL_BUDGET_MS } from "../verify-deployed-source-tags.mjs";
import { DEPLOY_WORKFLOW_PATH } from "./workflow-source.mjs";

// Both public verifications run inside the armed rollback trap, so the job has to
// outlast them and still have time to restore every promoted surface.
const ROLLBACK_HEADROOM_SECONDS = 180;

export function collectDeployTransactionFailures(source) {
  let workflow;
  try {
    workflow = parse(source);
  } catch (error) {
    const message = errorMessage(error);
    return [`${DEPLOY_WORKFLOW_PATH}: failed to parse workflow YAML: ${message}`];
  }

  const promoteDeploy = workflow?.jobs?.["promote-deploy"];
  const step = promoteDeploy?.steps?.find(
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
  if (!run.includes('cat "${IMAGE_DIGEST_DIR}/${image}"') || run.includes(':${SOURCE_TAG}"')) {
    failures.push(
      `${DEPLOY_WORKFLOW_PATH}: promotion must read the recorded scan digest instead of re-resolving the source tag`,
    );
  }
  if (!run.includes('trigger "${service}" "${webhook}" ""')) {
    failures.push(
      `${DEPLOY_WORKFLOW_PATH}: rollback trigger must not report an image digest as source_sha`,
    );
  }
  // The registry publishes no source-tag, so verify-deployed-source-tags never waits
  // for it. A single-shot live check inside the armed rollback trap reverts every
  // promoted surface whenever the registry container is slower than the check.
  const registryPollIndex = run.indexOf("verify_registry() {");
  const liveCheckIndex = run.indexOf("scripts/monorepo/check-live-registry.mjs");
  if (
    registryPollIndex < 0 ||
    liveCheckIndex < 0 ||
    liveCheckIndex !== run.lastIndexOf("scripts/monorepo/check-live-registry.mjs") ||
    liveCheckIndex < registryPollIndex
  ) {
    failures.push(
      `${DEPLOY_WORKFLOW_PATH}: the hosted registry live check must run through the bounded readiness poll`,
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
  failures.push(...collectVerificationBudgetFailures(promoteDeploy, run));

  return failures;
}

// A poll bounded only by attempt count bounds its sleeping, not its total time: one
// attempt sweeps every committed registry endpoint. Without a wall-clock bound the
// verifications can outlast the job, which cancels the runner with :prod already
// moved and the rollback trap only part way through restoring it.
function collectVerificationBudgetFailures(promoteDeploy, run) {
  const registryBudgetSeconds = Number(run.match(/^\s*budget_seconds=(\d+)$/m)?.[1]);
  if (!Number.isFinite(registryBudgetSeconds)) {
    return [
      `${DEPLOY_WORKFLOW_PATH}: the hosted registry readiness poll must bound its total wall clock`,
    ];
  }

  const jobBudgetSeconds = Number(promoteDeploy?.["timeout-minutes"]) * 60;
  const verificationSeconds = SOURCE_TAG_POLL_BUDGET_MS / 1000 + registryBudgetSeconds;
  if (!(jobBudgetSeconds >= verificationSeconds + ROLLBACK_HEADROOM_SECONDS)) {
    return [
      `${DEPLOY_WORKFLOW_PATH}: promote-deploy allows ${jobBudgetSeconds}s for ${verificationSeconds}s of verification plus ${ROLLBACK_HEADROOM_SECONDS}s of rollback headroom`,
    ];
  }

  return [];
}
