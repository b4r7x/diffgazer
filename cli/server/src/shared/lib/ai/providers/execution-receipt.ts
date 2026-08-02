import {
  ExecutionReceiptSchema,
  type ExecutionResult,
  hashExecutionReceiptFingerprintSync,
  type NormalizedUsage,
  type ReviewResult,
  type TerminalOutcome,
  type UsageAvailability,
} from "@diffgazer/core/schemas/review";
import type { AttemptEstimate } from "../budget/ledger.js";
import { type AdapterExecuteRequest, assertBoundedExecutionResult } from "../types.js";

/** Every terminal outcome that carries zero findings. */
export type FailedTerminalOutcome = Exclude<TerminalOutcome, "completed">;

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

function buildReceipt(
  request: AdapterExecuteRequest,
  outcome: TerminalOutcome,
  settlement: ExecutionSettlement,
) {
  const key = request.evidenceKey;
  const usageAvailability = settlement.usageAvailability ?? "unavailable";
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
    region: key.region ?? undefined,
    workspace: key.workspaceAccountReference ?? undefined,
    runtime: key.runtime,
    structuredOutputSchemaSha256: key.structuredOutputSchemaSha256,
    noticeVersion: key.noticeVersion,
    limits: key.limits,
    attemptCount: settlement.attemptCount,
    startedAt: settlement.startedAt,
    finishedAt: settlement.finishedAt,
    usage: usageAvailability === "reported" ? settlement.usage : undefined,
    usageAvailability,
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
 * Conservative pre-dispatch reservation for transports that cannot estimate a
 * prompt cost: full admitted response/wall-time budget, clamped token budgets.
 */
export function conservativeAttemptEstimate(
  limits: AdapterExecuteRequest["evidenceKey"]["limits"],
): AttemptEstimate {
  return {
    inputTokens: Math.min(limits.maxInputTokens, 4_096),
    outputTokens: Math.min(limits.maxOutputTokens, 1_024),
    responseBytes: limits.maxResponseBytes,
    wallTimeMs: limits.wallTimeMs,
    costUsd: 0,
  };
}

/** Zero-usage settlement for transports whose providers report no usage. */
export const ZERO_ATTEMPT_ACTUAL: AttemptEstimate = {
  inputTokens: 0,
  outputTokens: 0,
  responseBytes: 0,
  wallTimeMs: 0,
  costUsd: 0,
};
