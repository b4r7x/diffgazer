import { ConfigurationIdSchema } from "@diffgazer/core/schemas/config";
import type { AuthorizedReviewExecution } from "../../shared/lib/ai/admission/service.js";
import { MALFORMED_AFTER_CORRECTION_DIAGNOSTIC_CODE } from "../../shared/lib/ai/diagnostics.js";
import { createAdmissionEvidence } from "../../shared/lib/config/admission-evidence.js";
import { getStore } from "../../shared/lib/config/store.js";
import { log } from "../../shared/lib/log.js";
import type { ReviewExecutionContext, ReviewOutcome } from "./types.js";

function conformanceEvidenceStatus(
  outcome: ReviewOutcome,
  evidenceState: "proven" | "unproven",
): "failed" | "passed" | null {
  const receipt = outcome.execution?.receipt;
  if (receipt === undefined) return null;
  // A dispatch the adapter completed by salvaging individual issues counts as
  // passed here, which slightly overstates a tuple that never emitted a whole
  // valid answer. Deliberate: findings were delivered, and the alternative —
  // memoizing incapacity for a model that keeps producing usable issues — costs
  // the user reviews that work.
  if (receipt.outcome === "completed" && evidenceState === "unproven") return "passed";
  // `schema-failed` on a review receipt already means every lens schema-failed
  // (the orchestration's unanimous verdict); on top of that the memo demands
  // the decisive dispatch prove incapacity — malformed content the corrective
  // re-ask replayed and the model still could not fix. Only the adapter knows
  // whether a retry carried a correction, so it names that class with its own
  // diagnostic code; an attempt count also rises on blind retries. Truncation
  // and reasoning burn are geometry failures this setup can survive on the next
  // run, so they never arm the memo.
  if (
    receipt.outcome === "schema-failed" &&
    outcome.terminalDiagnostic?.code === MALFORMED_AFTER_CORRECTION_DIAGNOSTIC_CODE
  ) {
    return "failed";
  }
  return null;
}

const passedEvidenceRecorded = new WeakSet<AuthorizedReviewExecution>();

/** Whether the verdict actually landed on disk; a failed write is warn-only. */
async function writeConformanceEvidence(
  authorization: AuthorizedReviewExecution,
  status: "failed" | "passed",
  reviewId: string | undefined,
): Promise<boolean> {
  const { plan } = authorization;
  const recorded = await getStore().recordConfigurationEvidence(
    ConfigurationIdSchema.parse(plan.configurationId),
    createAdmissionEvidence({
      evidenceKey: plan.evidenceKey,
      checkedAt: new Date().toISOString(),
      status,
      expiresAt: null,
    }),
  );
  if (!recorded.ok) {
    log("warn", "review_conformance_evidence_unrecorded", {
      reviewId,
      configurationId: plan.configurationId,
      status,
      code: recorded.error.code,
    });
  }
  return recorded.ok;
}

/**
 * The first schema-valid structured response proves exactly what the explicit
 * Verify probe proves, so an unproven admission files its passed evidence then
 * rather than after the whole orchestration settles. One landed write per
 * authorization: the completion-time recorder routes through here and finds the
 * proof already filed — unless the early write failed, which re-arms it as the
 * fallback it is meant to be.
 */
export async function recordPassedConformanceEvidence(
  authorization: AuthorizedReviewExecution,
  reviewId?: string,
): Promise<void> {
  if (authorization.evidenceState !== "unproven") return;
  if (passedEvidenceRecorded.has(authorization)) return;
  if (await writeConformanceEvidence(authorization, "passed", reviewId)) {
    passedEvidenceRecorded.add(authorization);
  }
}

/**
 * The review is the conformance check. Proven incapacity — every lens
 * schema-failed on malformed content the corrective retry could not fix —
 * caches the fast-fail for this exact tuple; a completed review records the
 * proof an unproven admission went without, unless the first structured
 * response already filed it. Recording is best effort: a tuple edited
 * mid-review loses the cache entry, never the review the user is watching.
 */
export async function recordConformanceEvidence(
  executionContext: ReviewExecutionContext,
  outcome: ReviewOutcome,
  reviewId: string,
): Promise<void> {
  const { authorization } = executionContext;
  const status = conformanceEvidenceStatus(outcome, authorization.evidenceState);
  if (!status) return;
  if (status === "passed") {
    await recordPassedConformanceEvidence(authorization, reviewId);
    return;
  }
  await writeConformanceEvidence(authorization, status, reviewId);
}
