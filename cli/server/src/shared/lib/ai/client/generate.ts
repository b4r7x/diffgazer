import { getErrorMessage } from "@diffgazer/core/errors";
import {
  ExecutionReceiptSchema,
  type ExecutionResult,
  ExecutionResultSchema,
  hashExecutionReceiptFingerprintSync,
  type NormalizedUsage,
  NormalizedUsageSchema,
  type TerminalOutcome,
  type UsageAvailability,
} from "@diffgazer/core/schemas/review";
import type { AdmittedExecutionPlan, AuthorizedReviewExecution } from "../admission/service.js";
import type { AttemptActual, AttemptEstimate, BudgetLimitKey } from "../budget/ledger.js";
import {
  type BoundedDiagnostic,
  type DiagnosticCapture,
  type DiagnosticSensitiveContext,
  serializeCancelDiagnostic,
  serializeFailureDiagnostic,
  serializeSuccessDiagnostic,
} from "../diagnostics.js";
import { assertBoundedExecutionResult } from "../types.js";
import { createFromAdmittedPlan } from "./create.js";

export function estimatePromptTokens(prompt: string): number {
  return Math.ceil(prompt.length / 4);
}

export function conservativeAttemptEstimate(
  prompt: string,
  limits: AdmittedExecutionPlan["limits"],
): AttemptEstimate {
  return {
    inputTokens: Math.min(estimatePromptTokens(prompt), limits.maxInputTokens),
    outputTokens: limits.maxOutputTokens,
    responseBytes: limits.maxResponseBytes,
    wallTimeMs: limits.wallTimeMs,
    costUsd: limits.maxCostUsd,
  };
}

export type ExecuteReviewGenerationInput = Readonly<{
  authorization: AuthorizedReviewExecution;
  prompt: string;
  signal?: AbortSignal;
}>;

export type ExecuteReviewGenerationResult = Readonly<{
  execution: ExecutionResult;
  diagnostic: BoundedDiagnostic;
}>;

function sensitiveContextFromPlan(plan: AdmittedExecutionPlan): DiagnosticSensitiveContext {
  const literals: string[] = [];
  if (plan.evidenceKey.credentialReferenceIdentity) {
    literals.push(plan.evidenceKey.credentialReferenceIdentity);
  }
  if (plan.evidenceKey.workspaceAccountReference) {
    literals.push(plan.evidenceKey.workspaceAccountReference);
  }
  return {
    literalSecrets: literals,
    workspaceAccountReferences: plan.evidenceKey.workspaceAccountReference
      ? [plan.evidenceKey.workspaceAccountReference]
      : [],
  };
}

/**
 * Settles measured wall time and provider-reported tokens only. Response bytes
 * and cost are transport-measured or provider-billed facts; a receipt that does
 * not carry them leaves those dimensions unsettled rather than estimated.
 */
function actualFromReceipt(receipt: ExecutionResult["receipt"]): AttemptActual {
  const wallTimeMs = Math.max(0, Date.parse(receipt.finishedAt) - Date.parse(receipt.startedAt));
  const usage = receipt.usageAvailability === "reported" ? receipt.usage : undefined;
  return {
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    wallTimeMs,
  };
}

function buildPlanReceipt(
  plan: AdmittedExecutionPlan,
  input: Readonly<{
    outcome: TerminalOutcome;
    attemptCount: number;
    startedAt: string;
    finishedAt: string;
    usageAvailability: UsageAvailability;
    usage?: NormalizedUsage;
  }>,
) {
  const { evidenceKey } = plan;
  const executionFingerprint = hashExecutionReceiptFingerprintSync({
    configurationId: plan.configurationId,
    configurationRevision: plan.configurationRevision,
    authentication: evidenceKey.authentication,
    credentialReferenceIdentity: evidenceKey.credentialReferenceIdentity,
    installationId: evidenceKey.installationId,
    productId: evidenceKey.productId,
    transportFamily: evidenceKey.transportFamily,
    modelId: evidenceKey.modelId,
    normalizedEndpoint: evidenceKey.normalizedEndpoint,
    region: evidenceKey.region,
    workspaceAccountReference: evidenceKey.workspaceAccountReference,
    runtime: evidenceKey.runtime,
    structuredOutputSchemaSha256: evidenceKey.structuredOutputSchemaSha256,
    noticeVersion: evidenceKey.noticeVersion,
    limits: plan.limits,
  });
  const { usageAvailability } = input;
  return ExecutionReceiptSchema.parse({
    schemaVersion: 1,
    executionFingerprint,
    configurationId: plan.configurationId,
    configurationRevision: plan.configurationRevision,
    authentication: evidenceKey.authentication,
    credentialReferenceIdentity: evidenceKey.credentialReferenceIdentity,
    installationId: evidenceKey.installationId,
    productId: evidenceKey.productId,
    transportFamily: evidenceKey.transportFamily,
    modelId: evidenceKey.modelId,
    normalizedEndpoint: evidenceKey.normalizedEndpoint,
    region: evidenceKey.region ?? undefined,
    workspace: evidenceKey.workspaceAccountReference ?? undefined,
    runtime: evidenceKey.runtime,
    structuredOutputSchemaSha256: evidenceKey.structuredOutputSchemaSha256,
    noticeVersion: evidenceKey.noticeVersion,
    limits: plan.limits,
    attemptCount: input.attemptCount,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    usage: usageAvailability === "reported" ? input.usage : undefined,
    usageAvailability,
    outcome: input.outcome,
  });
}

/**
 * The single builder for a terminal execution result bound to an admitted plan.
 * Findings are kept only for a completed outcome, and usage is recorded only
 * when the adapter reported it.
 */
export function buildExecutionResult(
  plan: AdmittedExecutionPlan,
  outcome: TerminalOutcome,
  input: Readonly<{
    attemptCount?: number;
    startedAt?: string;
    finishedAt?: string;
    usageAvailability?: UsageAvailability;
    usage?: NormalizedUsage;
    issues?: ExecutionResult["result"]["issues"];
  }> = {},
): ExecutionResult {
  const startedAt = input.startedAt ?? new Date().toISOString();
  const finishedAt = input.finishedAt ?? startedAt;
  const usageAvailability = input.usageAvailability ?? (input.usage ? "reported" : "unavailable");
  return ExecutionResultSchema.parse({
    receipt: buildPlanReceipt(plan, {
      outcome,
      attemptCount: input.attemptCount ?? 1,
      startedAt,
      finishedAt,
      usageAvailability,
      usage:
        usageAvailability === "reported" ? NormalizedUsageSchema.parse(input.usage) : undefined,
    }),
    result: { issues: outcome === "completed" ? (input.issues ?? []) : [] },
  });
}

function diagnosticForOutcome(
  plan: AdmittedExecutionPlan,
  outcome: TerminalOutcome,
  input: Readonly<{
    limit?: BudgetLimitKey;
    message?: string;
    capture?: DiagnosticCapture;
  }> = {},
): BoundedDiagnostic {
  const sensitive = sensitiveContextFromPlan(plan);
  if (outcome === "completed") {
    return serializeSuccessDiagnostic({ sensitive });
  }
  if (outcome === "cancelled") {
    return serializeCancelDiagnostic({
      sensitive,
      message: input.message ?? "Execution was cancelled.",
      capture: input.capture,
    });
  }
  if (outcome === "budget-exhausted") {
    const limitLabel = input.limit ?? "maxInputTokens";
    return serializeFailureDiagnostic({
      code: "budget-exhausted",
      message:
        input.message ?? `Review budget exhausted at ${limitLabel} (${plan.limits[limitLabel]}).`,
      remediation: "Reduce review scope or increase configured limits.",
      sensitive,
      capture: input.capture,
    });
  }
  return serializeFailureDiagnostic({
    code: outcome,
    message: input.message ?? `Execution ended with outcome ${outcome}.`,
    sensitive,
    capture: input.capture,
  });
}

function zeroFindingsUnlessCompleted(execution: ExecutionResult): ExecutionResult {
  if (execution.receipt.outcome === "completed") {
    return execution;
  }
  return assertBoundedExecutionResult({
    receipt: execution.receipt,
    result: { issues: [] },
  });
}

function terminalOutcomeMessage(outcome: TerminalOutcome): string | undefined {
  switch (outcome) {
    case "transport-failed":
      return "Adapter transport failed.";
    case "schema-failed":
      return "Adapter response failed schema validation.";
    case "timed-out":
      return "Adapter execution timed out.";
    default:
      return undefined;
  }
}

export async function executeReviewGeneration(
  input: ExecuteReviewGenerationInput,
): Promise<ExecuteReviewGenerationResult> {
  const { authorization, prompt, signal } = input;
  const { plan, budgetLedger, budgetReservation } = authorization;
  const startedAt = new Date().toISOString();

  if (signal?.aborted) {
    return {
      execution: buildExecutionResult(plan, "cancelled", { attemptCount: 0, startedAt }),
      diagnostic: diagnosticForOutcome(plan, "cancelled", {
        message: "Execution was cancelled before adapter dispatch.",
      }),
    };
  }

  if (estimatePromptTokens(prompt) > plan.limits.maxInputTokens) {
    return {
      execution: buildExecutionResult(plan, "budget-exhausted", { attemptCount: 0, startedAt }),
      diagnostic: diagnosticForOutcome(plan, "budget-exhausted", {
        limit: "maxInputTokens",
        message: `Prompt exceeds admitted maxInputTokens (${plan.limits.maxInputTokens}).`,
      }),
    };
  }

  // Dispatch through the authorized server-only channel: the adapter admission
  // resolved plus the credential resolver bound to its secret binding.
  const clientResult = createFromAdmittedPlan(plan, {
    adapter: authorization.adapter,
    resolveCredential: authorization.resolveCredential,
    workspaceAccountId: authorization.workspaceAccountId,
  });
  if (!clientResult.ok) {
    return {
      execution: buildExecutionResult(plan, "transport-failed", { attemptCount: 0, startedAt }),
      diagnostic: serializeFailureDiagnostic({
        code: "transport-failed",
        message: clientResult.error.message,
        sensitive: sensitiveContextFromPlan(plan),
      }),
    };
  }

  let execution: ExecutionResult;
  try {
    execution = zeroFindingsUnlessCompleted(await clientResult.value.execute(prompt, { signal }));
  } catch (error) {
    // An adapter that throws — including one whose result breaks the bounded
    // execution contract — settles as a transport failure with no findings.
    budgetLedger.releaseReservation(budgetReservation);
    return {
      execution: buildExecutionResult(plan, "transport-failed", {
        startedAt,
        finishedAt: new Date().toISOString(),
      }),
      diagnostic: serializeFailureDiagnostic({
        code: "transport-failed",
        message: getErrorMessage(error),
        sensitive: sensitiveContextFromPlan(plan),
      }),
    };
  }

  const settle = budgetLedger.settleAttempt(
    budgetReservation,
    actualFromReceipt(execution.receipt),
  );
  if (!settle.ok) {
    execution = buildExecutionResult(plan, "budget-exhausted", {
      attemptCount: execution.receipt.attemptCount,
      startedAt: execution.receipt.startedAt,
      finishedAt: execution.receipt.finishedAt,
      usageAvailability: execution.receipt.usageAvailability,
      usage: execution.receipt.usage,
    });
    return {
      execution,
      diagnostic: diagnosticForOutcome(plan, "budget-exhausted", {
        limit: settle.error.limit,
      }),
    };
  }

  return {
    execution,
    diagnostic: diagnosticForOutcome(plan, execution.receipt.outcome, {
      message: terminalOutcomeMessage(execution.receipt.outcome),
    }),
  };
}
