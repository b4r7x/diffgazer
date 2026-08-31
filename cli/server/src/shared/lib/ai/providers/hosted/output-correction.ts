import type { HostedApiProductId } from "@diffgazer/core/schemas/config";
import { log } from "../../../log.js";
import {
  type BoundedDiagnostic,
  MALFORMED_AFTER_CORRECTION_DIAGNOSTIC_CODE,
  OUTPUT_SALVAGED_DIAGNOSTIC_CODE,
  serializeFailureDiagnostic,
  truncateUtf8,
} from "../../diagnostics.js";
import { estimatePromptTokens } from "../execution-receipt.js";
import type { OutputCorrection } from "./wire.js";

/** The failed answer replayed on a corrective retry, bounded so it cannot dominate the re-ask. */
const CORRECTION_FAILED_OUTPUT_MAX_BYTES = 8 * 1024;
/** Zod issue paths quoted back to the model; more adds noise, not signal. */
const CORRECTION_MAX_ISSUE_PATHS = 5;

export function buildOutputCorrection(failedOutput: string, problem: string): OutputCorrection {
  return {
    failedOutput: truncateUtf8(failedOutput, CORRECTION_FAILED_OUTPUT_MAX_BYTES),
    instruction: `Your previous response was not valid: ${problem} Respond with ONLY the corrected JSON object — no markdown fences, no commentary, no other text.`,
  };
}

export function correctionInputEstimate(correction: OutputCorrection): number {
  return (
    estimatePromptTokens("assistant") +
    estimatePromptTokens(correction.failedOutput) +
    estimatePromptTokens("user") +
    estimatePromptTokens(correction.instruction)
  );
}

export function zodIssuePaths(error: { issues: ReadonlyArray<{ path: PropertyKey[] }> }): string[] {
  const paths = new Set<string>();
  for (const issue of error.issues) {
    paths.add(issue.path.length === 0 ? "(root)" : issue.path.map(String).join("."));
    if (paths.size >= CORRECTION_MAX_ISSUE_PATHS) break;
  }
  return [...paths];
}

/** What every report about one answer shares: which dispatch it was, and what it said. */
export type MalformedOutputContext = Readonly<{
  productId: HostedApiProductId;
  /** One id for this answer's outcome, so diagnostic and log line name the same dispatch. */
  correlationId: string;
  finishReason: string;
  content: string;
  credential: string;
  reportDiagnostic?: (diagnostic: BoundedDiagnostic) => void;
}>;

/**
 * The head of the malformed answer, so a field failure leaves a fixture behind
 * instead of vanishing with the response body. Logged as well as reported:
 * downstream diagnostics drop truncatedDetails, so the log line is the only
 * place the fixture survives.
 */
function emitMalformedOutput(context: MalformedOutputContext, diagnostic: BoundedDiagnostic): void {
  log("warn", "hosted_malformed_output", {
    productId: context.productId,
    code: diagnostic.code,
    correlationId: diagnostic.correlationId,
    safeMessage: diagnostic.safeMessage,
    details: diagnostic.truncatedDetails,
  });
  context.reportDiagnostic?.(diagnostic);
}

/**
 * Only an answer the corrective retry already faced proves the tuple cannot
 * conform; malformed content on a first attempt — or after a blind retry that
 * carried no correction — leaves that question open, so the two carry different
 * codes and only the corrected one arms the fail-fast memo.
 */
export function reportMalformedOutput(
  context: MalformedOutputContext,
  params: Readonly<{ stage: string; corrected: boolean; invalidPaths?: readonly string[] }>,
): void {
  emitMalformedOutput(
    context,
    serializeFailureDiagnostic({
      code: params.corrected
        ? MALFORMED_AFTER_CORRECTION_DIAGNOSTIC_CODE
        : "malformed-review-output",
      correlationId: context.correlationId,
      retryable: false,
      message: `The model's answer failed ${params.stage} (finish reason "${context.finishReason}").`,
      ...(params.invalidPaths?.length
        ? { details: [{ label: "invalid-paths", text: params.invalidPaths.join(", ") }] }
        : {}),
      capture: { channel: "response", text: context.content },
      sensitive: { literalSecrets: [context.credential] },
    }),
  );
}

export function reportTruncatedOutput(context: MalformedOutputContext): void {
  emitMalformedOutput(
    context,
    serializeFailureDiagnostic({
      code: "output-truncated",
      correlationId: context.correlationId,
      retryable: false,
      message: `The model ran out of completion budget mid-answer (finish reason "${context.finishReason}") and returned truncated review output.`,
      remediation:
        "Reduce the review scope, or pick a model or plan with a larger completion limit.",
      capture: { channel: "response", text: context.content },
      sensitive: { literalSecrets: [context.credential] },
    }),
  );
}

/**
 * A partial salvage still hands the user findings, so it is not a failure — but
 * the answer it came from was incomplete, and the candidates salvage threw away
 * are evidence the lens is not whole. Reported as a non-retryable warning so the
 * dispatch is qualified rather than presented as an ordinary complete answer.
 */
export function reportSalvagedOutput(
  context: MalformedOutputContext,
  counts: Readonly<{ keptCount: number; droppedCount: number }>,
): void {
  log("warn", "hosted_salvaged_output", {
    productId: context.productId,
    correlationId: context.correlationId,
    keptCount: counts.keptCount,
    droppedCount: counts.droppedCount,
  });
  context.reportDiagnostic?.({
    ...serializeFailureDiagnostic({
      code: OUTPUT_SALVAGED_DIAGNOSTIC_CODE,
      correlationId: context.correlationId,
      retryable: false,
      message: `The model's answer was incomplete (finish reason "${context.finishReason}"); ${counts.keptCount} finding(s) were salvaged and ${counts.droppedCount} candidate(s) were dropped.`,
      remediation:
        "Reduce the review scope, or pick a model or plan with a larger completion limit, then rerun for a whole answer.",
      sensitive: { literalSecrets: [context.credential] },
    }),
    salvage: { keptFindingCount: counts.keptCount, droppedCandidateCount: counts.droppedCount },
  });
}
