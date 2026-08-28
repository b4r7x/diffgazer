import {
  ExecutionReceiptSchema,
  type ExecutionReceiptUsageState,
  type ExecutionResult,
  ExecutionResultSchema,
  hashExecutionReceiptFingerprintSync,
  type NormalizedUsage,
  NormalizedUsageSchema,
  type TerminalOutcome,
  type UsageAvailability,
} from "@diffgazer/core/schemas/review";
import {
  type AdmittedExecutionPlan,
  type AuthorizedReviewExecution,
  STRUCTURED_OUTPUT_FAILURE_GUIDANCE,
} from "../admission/service.js";
import { estimateUsageCostUsd, resolveModelPricing } from "../budget/cost.js";
import type { AttemptActual, BudgetLimitKey, BudgetLimits } from "../budget/ledger.js";
import {
  type BoundedDiagnostic,
  type DiagnosticCapture,
  type DiagnosticSensitiveContext,
  MALFORMED_AFTER_CORRECTION_DIAGNOSTIC_CODE,
  serializeCancelDiagnostic,
  serializeFailureDiagnostic,
  serializeSuccessDiagnostic,
} from "../diagnostics.js";
import { estimateReviewInputTokens } from "../providers/execution-receipt.js";
import { assertBoundedExecutionResult } from "../types.js";
import { createFromAdmittedPlan, type ExecuteOptions } from "./create.js";

export type ExecuteReviewGenerationInput = Readonly<{
  authorization: AuthorizedReviewExecution;
  prompt: string;
  systemPrompt?: string;
  signal?: AbortSignal;
  onProgress?: ExecuteOptions["onProgress"];
}>;

export type ExecuteReviewGenerationResult = Readonly<{
  execution: ExecutionResult;
  diagnostic: BoundedDiagnostic;
}>;

type BuildExecutionUsageInput =
  | { usage: NormalizedUsage; usageAvailability?: "reported" }
  | { usage?: undefined; usageAvailability?: "unavailable" }
  | Extract<ExecutionReceiptUsageState, { usageAvailability: "required-missing" }>;

export function normalizeBuildExecutionUsageInput(input: {
  usageAvailability?: UsageAvailability;
  usage?: NormalizedUsage;
}): ExecutionReceiptUsageState {
  if (input.usage !== undefined) {
    return {
      usageAvailability: "reported",
      usage: NormalizedUsageSchema.parse(input.usage),
    };
  }
  if (input.usageAvailability === "reported" || input.usageAvailability === "required-missing") {
    return { usageAvailability: "required-missing" };
  }
  return { usageAvailability: input.usageAvailability ?? "unavailable" };
}

function sensitiveContextFromPlan(plan: AdmittedExecutionPlan): DiagnosticSensitiveContext {
  const literals: string[] = [];
  if (plan.evidenceKey.credentialReferenceIdentity) {
    literals.push(plan.evidenceKey.credentialReferenceIdentity);
  }
  return { literalSecrets: literals };
}

/**
 * Settles provider-reported tokens and the dollars those tokens cost at the
 * admitted model's pinned catalog price. Response bytes are a transport-measured
 * fact a receipt that omits them leaves unsettled, and a model the catalog does
 * not price settles no cost rather than an invented one. Wall time is never
 * settled: the review wall budget is an elapsed clock the ledger consults, so a
 * dispatch's own duration must not drain its siblings' time.
 */
function actualFromReceipt(receipt: ExecutionResult["receipt"]): AttemptActual {
  const usage = receipt.usageAvailability === "reported" ? receipt.usage : undefined;
  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;
  const pricing = resolveModelPricing(receipt.productId, receipt.modelId);
  return {
    inputTokens,
    ...(pricing ? { costUsd: estimateUsageCostUsd(pricing, { inputTokens, outputTokens }) } : {}),
  };
}

function buildPlanReceipt(
  plan: AdmittedExecutionPlan,
  input: Readonly<
    {
      outcome: TerminalOutcome;
      attemptCount: number;
      startedAt: string;
      finishedAt: string;
      scope?: "dispatch" | "review";
      dispatchCount?: number;
    } & ExecutionReceiptUsageState
  >,
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
    runtime: evidenceKey.runtime,
    structuredOutputSchemaSha256: evidenceKey.structuredOutputSchemaSha256,
    noticeVersion: evidenceKey.noticeVersion,
    limits: plan.limits,
    attemptCount: input.attemptCount,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    ...(input.scope !== undefined ? { scope: input.scope } : {}),
    ...(input.dispatchCount !== undefined ? { dispatchCount: input.dispatchCount } : {}),
    ...(usageAvailability === "reported" && input.usage !== undefined
      ? { usage: input.usage }
      : {}),
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
  input: Readonly<
    {
      attemptCount?: number;
      startedAt?: string;
      finishedAt?: string;
      scope?: "dispatch" | "review";
      dispatchCount?: number;
      issues?: ExecutionResult["result"]["issues"];
    } & BuildExecutionUsageInput
  > = {},
): ExecutionResult {
  const startedAt = input.startedAt ?? new Date().toISOString();
  const finishedAt = input.finishedAt ?? startedAt;
  const usageState: ExecutionReceiptUsageState = normalizeBuildExecutionUsageInput(input);
  return ExecutionResultSchema.parse({
    receipt: buildPlanReceipt(plan, {
      outcome,
      attemptCount: input.attemptCount ?? 1,
      startedAt,
      finishedAt,
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      ...(input.dispatchCount !== undefined ? { dispatchCount: input.dispatchCount } : {}),
      ...usageState,
    }),
    result: { issues: outcome === "completed" ? (input.issues ?? []) : [] },
  });
}

/**
 * User-facing budget exhaustion prose built from the operative ledger limit,
 * never the unscaled configured base. The wall dimension is an elapsed clock,
 * so callers that measured the review's elapsed time render it alongside the
 * limit; every other dimension prints the limit alone.
 */
export function budgetExhaustedMessage(
  limit: BudgetLimitKey,
  limitValue: number,
  elapsedMs?: number,
): string {
  if (limit === "wallTimeMs" && elapsedMs !== undefined) {
    const elapsedSeconds = Math.round(elapsedMs / 1000);
    const limitSeconds = Math.round(limitValue / 1000);
    return `Review wall-clock budget exhausted: ${elapsedSeconds}s elapsed of ${limitSeconds}s allowed.`;
  }
  return `Review budget exhausted at ${limit} (${limitValue}).`;
}

function diagnosticForOutcome(
  plan: AdmittedExecutionPlan,
  outcome: TerminalOutcome,
  input: Readonly<{
    limit?: BudgetLimitKey;
    limits?: BudgetLimits;
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
        input.message ??
        budgetExhaustedMessage(limitLabel, (input.limits ?? plan.limits)[limitLabel]),
      remediation: "Reduce review scope or increase configured limits.",
      sensitive,
      capture: input.capture,
    });
  }
  // No STRUCTURED_OUTPUT_FAILURE_GUIDANCE here: a schema failure without an
  // adapter diagnostic never arms the fail-fast memo, so the "fail immediately"
  // sentence would be a false promise. Memo-class failures get it below.
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

const ADAPTER_THROW_DIAGNOSTIC_MESSAGE = "Adapter execution failed.";

export async function executeReviewGeneration(
  input: ExecuteReviewGenerationInput,
): Promise<ExecuteReviewGenerationResult> {
  const { authorization, prompt, systemPrompt, signal, onProgress } = input;
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

  if (estimateReviewInputTokens({ prompt, systemPrompt }) > plan.limits.maxInputTokens) {
    return {
      execution: buildExecutionResult(plan, "budget-exhausted", { attemptCount: 0, startedAt }),
      diagnostic: diagnosticForOutcome(plan, "budget-exhausted", {
        limit: "maxInputTokens",
        message: `Review input exceeds admitted maxInputTokens (${plan.limits.maxInputTokens}).`,
      }),
    };
  }

  // Dispatch through the authorized server-only channel: the adapter admission
  // resolved plus the credential resolver bound to its secret binding.
  let adapterDiagnostic: BoundedDiagnostic | undefined;
  const clientResult = createFromAdmittedPlan(plan, {
    adapter: authorization.adapter,
    resolveCredential: authorization.resolveCredential,
    reportDiagnostic: (diagnostic) => {
      adapterDiagnostic = diagnostic;
    },
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
    execution = zeroFindingsUnlessCompleted(
      await clientResult.value.execute(prompt, { signal, systemPrompt, onProgress }),
    );
  } catch {
    // An adapter that throws — including one whose result breaks the bounded
    // execution contract — settles as a transport failure with no findings.
    // No usage is committed; the per-review reservation stays open so every
    // later lens dispatch keeps drawing down the same admitted envelope
    // instead of no-op settling against a deleted record.
    const finishedAt = new Date().toISOString();
    const settleFailure = budgetLedger.commitAttemptUsage(budgetReservation, {
      inputTokens: 0,
    });
    if (!settleFailure.ok) {
      return {
        execution: buildExecutionResult(plan, "budget-exhausted", { startedAt, finishedAt }),
        diagnostic: diagnosticForOutcome(plan, "budget-exhausted", {
          limit: settleFailure.error.limit,
          limits: budgetLedger.limits,
        }),
      };
    }
    return {
      execution: buildExecutionResult(plan, "transport-failed", {
        startedAt,
        finishedAt,
      }),
      diagnostic: serializeFailureDiagnostic({
        code: "transport-failed",
        message: ADAPTER_THROW_DIAGNOSTIC_MESSAGE,
      }),
    };
  }

  const settle = budgetLedger.commitAttemptUsage(
    budgetReservation,
    actualFromReceipt(execution.receipt),
  );
  if (!settle.ok) {
    execution = buildExecutionResult(plan, "budget-exhausted", {
      attemptCount: execution.receipt.attemptCount,
      startedAt: execution.receipt.startedAt,
      finishedAt: execution.receipt.finishedAt,
      ...normalizeBuildExecutionUsageInput({
        usageAvailability: execution.receipt.usageAvailability,
        usage: execution.receipt.usage,
      }),
    });
    return {
      execution,
      diagnostic: diagnosticForOutcome(plan, "budget-exhausted", {
        limit: settle.error.limit,
        limits: budgetLedger.limits,
      }),
    };
  }

  // The adapter's own account of a refused request beats the generic outcome message.
  if (adapterDiagnostic) {
    // The fail-fast memo arms only on malformed content the corrective retry
    // could not fix (service.ts conformanceEvidenceStatus), so only that class
    // carries the memo's "fail immediately until it changes" sentence. The
    // adapter names that class with its own code: an attempt count cannot tell
    // a corrective retry from a blind one.
    const isMemoClassFailure =
      adapterDiagnostic.code === MALFORMED_AFTER_CORRECTION_DIAGNOSTIC_CODE;
    return {
      execution,
      diagnostic: isMemoClassFailure
        ? { ...adapterDiagnostic, remediation: STRUCTURED_OUTPUT_FAILURE_GUIDANCE }
        : adapterDiagnostic,
    };
  }
  return {
    execution,
    diagnostic: diagnosticForOutcome(plan, execution.receipt.outcome, {
      message: terminalOutcomeMessage(execution.receipt.outcome),
    }),
  };
}
