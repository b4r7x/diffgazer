import type { FailedTerminalOutcome } from "@diffgazer/core/review";
import {
  ExecutionReceiptSchema,
  type ExecutionResult,
  hashExecutionReceiptFingerprintSync,
  type NormalizedUsage,
  NormalizedUsageSchema,
  type ReviewResult,
  type TerminalOutcome,
  type UsageAvailability,
} from "@diffgazer/core/schemas/review";
import type { AttemptEstimate } from "../budget/ledger.js";
import { type AdapterExecuteRequest, assertBoundedExecutionResult } from "../types.js";

type FailedExecutionReceipt = Extract<
  ExecutionResult["receipt"],
  { outcome: FailedTerminalOutcome }
>;
type CompletedExecutionResult = Extract<ExecutionResult, { receipt: { outcome: "completed" } }>;

/** Timing, attempt accounting, and usage settled by a transport adapter. */
export type ExecutionSettlement = Readonly<{
  startedAt: string;
  finishedAt: string;
  attemptCount: number;
  usage?: NormalizedUsage;
  usageAvailability?: UsageAvailability;
}>;

type ReviewInputPayload = Readonly<{
  prompt: string;
  systemPrompt?: string;
}>;

function resolveReportedUsage(
  usageAvailability: UsageAvailability,
  usage: NormalizedUsage | undefined,
): Readonly<{ usageAvailability: UsageAvailability; usage: NormalizedUsage | undefined }> {
  if (usageAvailability !== "reported" || usage === undefined) {
    return { usageAvailability, usage: undefined };
  }
  const parsed = NormalizedUsageSchema.safeParse(usage);
  if (parsed.success) {
    return { usageAvailability: "reported", usage: parsed.data };
  }
  return { usageAvailability: "unavailable", usage: undefined };
}

function buildReceipt(
  request: AdapterExecuteRequest,
  outcome: TerminalOutcome,
  settlement: ExecutionSettlement,
) {
  const key = request.evidenceKey;
  const reported = resolveReportedUsage(
    settlement.usageAvailability ?? "unavailable",
    settlement.usage,
  );
  return ExecutionReceiptSchema.parse({
    schemaVersion: 1,
    executionFingerprint: hashExecutionReceiptFingerprintSync({
      configurationId: request.configurationId,
      configurationRevision: request.configurationRevision,
      authentication: key.authentication,
      credentialReferenceIdentity: key.credentialReferenceIdentity,
      installationId: key.installationId,
      productId: key.productId,
      transportFamily: key.transportFamily,
      modelId: key.modelId,
      normalizedEndpoint: key.normalizedEndpoint,
      region: key.region,
      workspaceAccountReference: key.workspaceAccountReference,
      runtime: key.runtime,
      structuredOutputSchemaSha256: key.structuredOutputSchemaSha256,
      noticeVersion: key.noticeVersion,
      limits: key.limits,
    }),
    configurationId: request.configurationId,
    configurationRevision: request.configurationRevision,
    authentication: key.authentication,
    credentialReferenceIdentity: key.credentialReferenceIdentity,
    installationId: key.installationId,
    productId: key.productId,
    transportFamily: key.transportFamily,
    modelId: key.modelId,
    normalizedEndpoint: key.normalizedEndpoint,
    runtime: key.runtime,
    structuredOutputSchemaSha256: key.structuredOutputSchemaSha256,
    noticeVersion: key.noticeVersion,
    limits: key.limits,
    attemptCount: settlement.attemptCount,
    startedAt: settlement.startedAt,
    finishedAt: settlement.finishedAt,
    ...(reported.usage === undefined ? {} : { usage: reported.usage }),
    usageAvailability: reported.usageAvailability,
    outcome,
  });
}

/** Builds the zero-findings execution result every transport returns on failure. */
export function createFailedExecutionResult(
  request: AdapterExecuteRequest,
  outcome: FailedTerminalOutcome,
  settlement: ExecutionSettlement,
): ExecutionResult {
  return assertBoundedExecutionResult({
    receipt: buildReceipt(request, outcome, settlement) as FailedExecutionReceipt,
    result: { issues: [] },
  } satisfies Extract<ExecutionResult, { receipt: { outcome: FailedTerminalOutcome } }>);
}

/** Builds the completed execution result carrying validated review findings. */
export function createCompletedExecutionResult(
  request: AdapterExecuteRequest,
  result: ReviewResult,
  settlement: ExecutionSettlement,
): ExecutionResult {
  return assertBoundedExecutionResult({
    receipt: buildReceipt(request, "completed", settlement) as CompletedExecutionResult["receipt"],
    result,
  } satisfies CompletedExecutionResult);
}

/**
 * Conservative pre-dispatch input token bound. Non-ASCII scalars (CJK, emoji,
 * etc.) budget at least one token each; mostly-ASCII repository text keeps a
 * UTF-8 byte /4 heuristic so Latin prompts are not over-rejected.
 *
 * Single owner on purpose: the pre-dispatch input gate and the hosted per-attempt
 * reservation must price the same prompt identically.
 */
export function estimatePromptTokens(prompt: string): number {
  let nonAsciiScalars = 0;
  for (const char of prompt) {
    const codePoint = char.codePointAt(0);
    if (codePoint !== undefined && codePoint > 0x7f) {
      nonAsciiScalars += 1;
    }
  }
  const byteHeuristic = Math.ceil(Buffer.byteLength(prompt, "utf8") / 4);
  return Math.max(nonAsciiScalars, byteHeuristic);
}

export function estimateReviewInputTokens(input: ReviewInputPayload): number {
  const userInputTokens = estimatePromptTokens("user") + estimatePromptTokens(input.prompt);
  if (input.systemPrompt === undefined || input.systemPrompt === "") {
    return userInputTokens;
  }
  return (
    estimatePromptTokens("system") +
    estimatePromptTokens(input.systemPrompt) +
    estimatePromptTokens("\n\n") +
    userInputTokens
  );
}

export function promptAttemptEstimate(
  input: ReviewInputPayload,
  limits: AdapterExecuteRequest["evidenceKey"]["limits"],
): AttemptEstimate {
  return {
    inputTokens: estimateReviewInputTokens(input),
    responseBytes: limits.maxResponseBytes,
    wallTimeMs: limits.wallTimeMs,
    costUsd: limits.maxCostUsd,
  };
}

/**
 * Conservative pre-dispatch reservation for transports that cannot estimate a
 * prompt cost: full admitted response/wall-time budget, clamped input tokens.
 */
export function conservativeAttemptEstimate(
  limits: AdapterExecuteRequest["evidenceKey"]["limits"],
): AttemptEstimate {
  return {
    inputTokens: Math.min(limits.maxInputTokens, 4_096),
    responseBytes: limits.maxResponseBytes,
    wallTimeMs: limits.wallTimeMs,
    costUsd: 0,
  };
}
