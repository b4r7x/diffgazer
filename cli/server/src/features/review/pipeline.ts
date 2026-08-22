import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { SettingsConfig } from "@diffgazer/core/schemas/config";
import {
  type ExecutionResult,
  type LensId,
  type NormalizedUsage,
  NormalizedUsageSchema,
  type ProfileId,
  ReviewErrorCode,
  ReviewErrorSchema,
  type ReviewMode,
  type ReviewResult,
  type ReviewSeverity,
  type SeverityFilter,
  severityRank,
  type TerminalOutcome,
  terminalOutcomeKeepsFindings,
  type UsageAvailability,
} from "@diffgazer/core/schemas/review";
import {
  type AuthorizedReviewExecution,
  STRUCTURED_OUTPUT_FAILURE_GUIDANCE,
} from "../../shared/lib/ai/admission/service.js";
import {
  buildExecutionResult,
  normalizeBuildExecutionUsageInput,
} from "../../shared/lib/ai/client/generate.js";
import { PROVIDER_REJECTED_DIAGNOSTIC_CODE } from "../../shared/lib/ai/diagnostics.js";
import type { AIClient, AIErrorDiagnostic } from "../../shared/lib/ai/types.js";
import { log } from "../../shared/lib/log.js";
import { type ReviewAbort, reviewAbort } from "./abort.js";
import { buildProjectContextSnapshot } from "./context/snapshot/build.js";
import type { ParsedDiff } from "./engine/diff/types.js";
import { orchestrateReview } from "./engine/orchestrate.js";
import { getProfile } from "./engine/profiles.js";
import { saveReview } from "./storage/reviews.js";
import { stepComplete, stepError, stepStart } from "./stream/steps.js";
import { markCommitted, markCommitting, markComplete } from "./stream/store.js";
import type {
  EmitFn,
  ResolvedConfig,
  ResolvedReviewDefaults,
  ReviewExecutionContext,
  ReviewOutcome,
} from "./types.js";

/** Resolve the active lenses using an explicit ordered fallback. */
function resolveActiveLenses(
  lensIds: LensId[] | undefined,
  profile: ReturnType<typeof getProfile> | undefined,
  settings: SettingsConfig,
): LensId[] {
  const selected =
    (lensIds?.length ? lensIds : undefined) ??
    (profile?.lenses.length ? profile.lenses : undefined) ??
    settings.defaultLenses;
  return [...new Set(selected)];
}

function resolveEffectiveProfileId(
  profileId: ProfileId | undefined,
  settings: SettingsConfig,
): ProfileId | undefined {
  return profileId ?? settings.defaultProfile ?? undefined;
}

function resolveSeverityFilter(
  profileFilter: SeverityFilter | undefined,
  severityThreshold: ReviewSeverity,
): SeverityFilter | undefined {
  const thresholdFilter = { minSeverity: severityThreshold };
  if (!profileFilter) {
    return thresholdFilter;
  }
  return severityRank(profileFilter.minSeverity) <= severityRank(thresholdFilter.minSeverity)
    ? profileFilter
    : thresholdFilter;
}

export function resolveReviewDefaults(params: {
  lensIds?: LensId[];
  profileId?: ProfileId;
  settings: SettingsConfig;
}): ResolvedReviewDefaults {
  const settings = params.settings;
  const effectiveProfileId = resolveEffectiveProfileId(params.profileId, settings);
  const profile = effectiveProfileId ? getProfile(effectiveProfileId) : undefined;
  const activeLenses = resolveActiveLenses(params.lensIds, profile, settings);
  const severityFilter = resolveSeverityFilter(profile?.filter, settings.severityThreshold);

  return {
    activeLenses,
    effectiveProfileId,
    profile,
    severityFilter,
    concurrency: settings.agentExecution === "parallel" ? activeLenses.length : 1,
  };
}

export async function resolveReviewConfig(params: {
  defaults: ResolvedReviewDefaults;
  projectPath: string;
  focusPaths?: readonly string[];
  emit: EmitFn;
  signal?: AbortSignal;
}): Promise<ResolvedConfig> {
  const { defaults, projectPath, focusPaths, emit, signal } = params;

  signal?.throwIfAborted();
  await emit(stepStart("context"));
  signal?.throwIfAborted();
  let projectContext = "";
  try {
    const contextSnapshot = await buildProjectContextSnapshot(projectPath, {
      ...(focusPaths && focusPaths.length > 0 ? { focusPaths } : {}),
    });
    signal?.throwIfAborted();
    projectContext = contextSnapshot.markdown;
    await emit(stepComplete("context"));
    signal?.throwIfAborted();
  } catch (error) {
    signal?.throwIfAborted();
    log("warn", "review_context_snapshot_failed", { error: getErrorMessage(error) });
    projectContext = "";
    await emit(stepError("context", `Context build failed: ${getErrorMessage(error)}`));
    signal?.throwIfAborted();
  }

  return { ...defaults, projectContext };
}

/** A client whose dispatches are observable, so the review can report what the adapter returned. */
type ReviewAIClient = AIClient & {
  authorization?: AuthorizedReviewExecution;
  terminalExecutions?: readonly ExecutionResult[];
  terminalDiagnostics?: readonly AIErrorDiagnostic[];
};

/**
 * The stream error code a failed terminal outcome reports. Failures with a
 * remedy the user can act on — a model that cannot produce structured output, a
 * provider that refused the request, a spent budget — get their own code so the
 * surfaces can name it; every other outcome stays a generic AI error.
 */
function terminalErrorCode(
  outcome: TerminalOutcome,
  diagnostic: AIErrorDiagnostic | undefined,
): ReviewErrorCode {
  if (outcome === "schema-failed") return ReviewErrorCode.MODEL_INCOMPATIBLE;
  if (outcome === "budget-exhausted") return ReviewErrorCode.BUDGET_EXHAUSTED;
  if (diagnostic?.code === PROVIDER_REJECTED_DIAGNOSTIC_CODE) {
    return ReviewErrorCode.PROVIDER_REJECTED;
  }
  return ReviewErrorCode.AI_ERROR;
}

function mapOrchestrationErrorToTerminalOutcome(error: { code: string }): TerminalOutcome {
  if (error.code === "PARSE_ERROR") return "schema-failed";
  return "transport-failed";
}

/**
 * The receipt whose outcome a failed review reports. A structured-output failure
 * is what decided the review — it aborts the lenses still in flight — so it wins
 * over a dispatch that merely failed first, and when the schema bridge rejected
 * the response itself the review reports no dispatch receipt at all.
 */
function failedDispatch(
  executions: readonly ExecutionResult[],
  error: { code: string },
): ExecutionResult["receipt"] | undefined {
  const schemaFailed = executions.find(
    (execution) => execution.receipt.outcome === "schema-failed",
  );
  if (schemaFailed) return schemaFailed.receipt;
  if (mapOrchestrationErrorToTerminalOutcome(error) === "schema-failed") return undefined;
  return executions.find((execution) => execution.receipt.outcome !== "completed")?.receipt;
}

function terminalDiagnosticForDispatch(
  executions: readonly ExecutionResult[],
  diagnostics: readonly AIErrorDiagnostic[] | undefined,
  decisiveReceipt: ExecutionResult["receipt"] | undefined,
): AIErrorDiagnostic | undefined {
  if (!diagnostics || diagnostics.length === 0) return undefined;
  if (!decisiveReceipt) return diagnostics.at(-1);

  const decisiveIndex = executions.findIndex((execution) => execution.receipt === decisiveReceipt);
  if (decisiveIndex < 0) return diagnostics.at(-1);

  let failedDispatchCount = 0;
  for (let index = 0; index <= decisiveIndex; index += 1) {
    if (executions[index]?.receipt.outcome !== "completed") failedDispatchCount += 1;
  }
  return diagnostics[failedDispatchCount - 1];
}

/**
 * With no dispatch receipt to measure, the only span available is the pipeline's
 * own wall clock, which includes orchestration overhead the per-dispatch limit
 * does not cover. Report it bounded by that limit rather than a duration the
 * receipt contract forbids.
 */
function clampToDispatchWallTime(
  span: { startedAt: string; finishedAt: string },
  wallTimeMs: number,
): { startedAt: string; finishedAt: string } {
  const startMs = Date.parse(span.startedAt);
  const finishMs = Date.parse(span.finishedAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(finishMs)) return span;
  return finishMs - startMs > wallTimeMs
    ? { startedAt: span.startedAt, finishedAt: new Date(startMs + wallTimeMs).toISOString() }
    : span;
}

const USAGE_FIELDS = [
  "inputTokens",
  "outputTokens",
  "cachedTokens",
  "reasoningTokens",
] as const satisfies readonly (keyof NormalizedUsage)[];

type AggregatedDispatchOutcome = Extract<TerminalOutcome, "completed" | "budget-exhausted">;

function reportedUsage(execution: ExecutionResult): NormalizedUsage | undefined {
  if (execution.receipt.usageAvailability !== "reported") return undefined;
  const parsed = NormalizedUsageSchema.safeParse(execution.receipt.usage);
  return parsed.success ? parsed.data : undefined;
}

function aggregateReportedUsage(
  executions: readonly ExecutionResult[],
): NormalizedUsage | undefined {
  const totals: Partial<Record<(typeof USAGE_FIELDS)[number], number>> = {};
  let hasReportedUsage = false;

  for (const execution of executions) {
    const usage = reportedUsage(execution);
    if (!usage) continue;

    hasReportedUsage = true;
    for (const field of USAGE_FIELDS) {
      const value = usage[field];
      if (value !== undefined) {
        totals[field] = (totals[field] ?? 0) + value;
      }
    }
  }

  if (!hasReportedUsage) return undefined;
  const usage =
    totals.inputTokens !== undefined && totals.outputTokens !== undefined
      ? { ...totals, totalTokens: totals.inputTokens + totals.outputTokens }
      : totals;

  const parsed = NormalizedUsageSchema.safeParse(usage);
  return parsed.success ? parsed.data : undefined;
}

function aggregateUsageState(
  executions: readonly ExecutionResult[],
  outcome: TerminalOutcome,
  fallbackAvailability?: UsageAvailability,
): { usageAvailability: UsageAvailability; usage?: NormalizedUsage } {
  const usage = aggregateReportedUsage(executions);
  if (usage !== undefined) {
    return { usageAvailability: "reported", usage };
  }

  if (executions.some((execution) => execution.receipt.usageAvailability === "reported")) {
    return { usageAvailability: "unavailable" };
  }

  if (fallbackAvailability !== undefined) {
    return { usageAvailability: fallbackAvailability };
  }

  if (
    outcome === "budget-exhausted" &&
    executions.at(-1)?.receipt.usageAvailability === "required-missing"
  ) {
    return { usageAvailability: "required-missing" };
  }

  return { usageAvailability: "unavailable" };
}

/**
 * A review-level receipt keeps timing and attempts from one dispatch because
 * the execution receipt retry limit is per dispatch. Usage is the only part
 * that aggregates across the dispatches represented by the review outcome.
 */
function aggregateDispatches(
  executions: readonly ExecutionResult[],
  fallback: { startedAt: string; finishedAt: string },
  wallTimeMs: number,
  outcome: AggregatedDispatchOutcome,
  decisiveReceipt?: ExecutionResult["receipt"],
): {
  startedAt: string;
  finishedAt: string;
  attemptCount?: number;
  usageAvailability: UsageAvailability;
  usage?: NormalizedUsage;
} {
  const completed = executions.filter((execution) => execution.receipt.outcome === "completed");
  const last = decisiveReceipt ?? completed.at(-1)?.receipt;
  const timing = last
    ? {
        startedAt: last.startedAt,
        finishedAt: last.finishedAt,
        attemptCount: last.attemptCount,
      }
    : { ...clampToDispatchWallTime(fallback, wallTimeMs), attemptCount: undefined };

  return {
    ...timing,
    ...aggregateUsageState(executions, outcome),
  };
}

function dispatchReceiptTiming(
  receipt: ExecutionResult["receipt"] | undefined,
  fallback: { startedAt: string; finishedAt?: string },
): {
  startedAt: string;
  finishedAt?: string;
  attemptCount?: number;
  usageAvailability?: ExecutionResult["receipt"]["usageAvailability"];
  usage?: ExecutionResult["receipt"]["usage"];
} {
  if (!receipt) {
    return fallback;
  }
  return {
    startedAt: receipt.startedAt,
    finishedAt: receipt.finishedAt,
    attemptCount: receipt.attemptCount,
    usageAvailability: receipt.usageAvailability,
    usage: receipt.usage,
  };
}

export async function executeReview(params: {
  aiClient: ReviewAIClient;
  parsed: ParsedDiff;
  config: ResolvedConfig;
  emit: EmitFn;
  signal?: AbortSignal;
  executionContext?: ReviewExecutionContext;
}): Promise<Result<ReviewOutcome, ReviewAbort>> {
  const { aiClient, parsed, config, emit, signal, executionContext } = params;
  const startedAt = new Date().toISOString();

  await emit(stepStart("review"));

  if (signal?.aborted && executionContext) {
    const execution = buildExecutionResult(executionContext.authorization.plan, "cancelled", {
      startedAt,
      attemptCount: 0,
    });
    return ok({ issues: [], execution });
  }

  const result = await orchestrateReview(
    aiClient,
    parsed,
    {
      lenses: config.activeLenses,
      filter: config.severityFilter,
    },
    async (event) => {
      await emit(event);
    },
    {
      concurrency: config.concurrency,
      projectContext: config.projectContext,
      signal,
    },
  );

  const finishedAt = new Date().toISOString();
  const dispatched = aiClient.terminalExecutions ?? [];

  if (!result.ok) {
    const classified = ReviewErrorSchema.safeParse(result.error);
    if (executionContext) {
      // The adapter's own terminal receipt decides the outcome, so `cancelled`,
      // `timed-out`, and `budget-exhausted` stay distinct from a transport failure.
      const budgetDispatch = dispatched.findLast(
        (execution) => execution.receipt.outcome === "budget-exhausted",
      );
      const failed = budgetDispatch?.receipt ?? failedDispatch(dispatched, result.error);
      const timing = dispatchReceiptTiming(failed, { startedAt, finishedAt });
      const terminalOutcome =
        failed?.outcome ?? mapOrchestrationErrorToTerminalOutcome(result.error);
      const usage = aggregateUsageState(dispatched, terminalOutcome, timing.usageAvailability);
      const execution = buildExecutionResult(executionContext.authorization.plan, terminalOutcome, {
        startedAt: timing.startedAt,
        finishedAt: timing.finishedAt,
        attemptCount: timing.attemptCount ?? failed?.attemptCount ?? 1,
        ...normalizeBuildExecutionUsageInput(usage),
      });
      const terminalDiagnostic = terminalDiagnosticForDispatch(
        dispatched,
        aiClient.terminalDiagnostics,
        failed,
      );
      return ok({ issues: [], execution, terminalDiagnostic });
    }
    return err(
      reviewAbort(
        result.error.message,
        classified.success ? classified.data.code : ReviewErrorCode.AI_ERROR,
        "review",
      ),
    );
  }

  await emit(stepComplete("review"));

  const outcome: ReviewOutcome = {
    issues: result.value.issues,
    lensStats: result.value.lensStats,
    droppedDuplicates: result.value.droppedDuplicates,
    droppedBelowThreshold: result.value.droppedBelowThreshold,
    minSeverity: result.value.minSeverity,
  };

  if (executionContext) {
    const budgetDispatch = dispatched.findLast(
      (execution) => execution.receipt.outcome === "budget-exhausted",
    );
    const reviewOutcome: AggregatedDispatchOutcome = budgetDispatch
      ? "budget-exhausted"
      : "completed";
    const timing = aggregateDispatches(
      dispatched,
      { startedAt, finishedAt },
      executionContext.authorization.plan.limits.wallTimeMs,
      reviewOutcome,
      budgetDispatch?.receipt,
    );
    outcome.execution = buildExecutionResult(executionContext.authorization.plan, reviewOutcome, {
      startedAt: timing.startedAt,
      finishedAt: timing.finishedAt,
      attemptCount: timing.attemptCount,
      issues: result.value.issues,
      ...normalizeBuildExecutionUsageInput({
        usageAvailability: timing.usageAvailability,
        usage: timing.usage,
      }),
    });
    if (budgetDispatch) {
      const terminalDiagnostic = aiClient.terminalDiagnostics?.findLast(
        (diagnostic) => diagnostic.code === "budget-exhausted",
      );
      if (terminalDiagnostic) outcome.terminalDiagnostic = terminalDiagnostic;
    }
  }

  return ok(outcome);
}

export async function finalizeReview(params: {
  outcome: ReviewOutcome;
  emit: EmitFn;
  reviewId: string;
  projectPath: string;
  mode: ReviewMode;
  parsed: ParsedDiff;
  profileId?: ProfileId;
  activeLenses: LensId[];
  durationMs: number;
  signal?: AbortSignal;
  branch: string | null;
  headCommit: string | null;
}): Promise<Result<ReviewResult, ReviewAbort>> {
  const {
    outcome,
    emit,
    reviewId,
    projectPath,
    mode,
    parsed,
    profileId,
    activeLenses,
    durationMs,
    signal,
    branch,
    headCommit,
  } = params;

  await emit(stepStart("report"));

  // A failed review keeps only the findings its outcome can vouch for: lenses
  // that settled inside an exhausted budget produced real ones, while every
  // other failure ended before the aggregate could be trusted.
  const terminalOutcome = outcome.execution?.receipt.outcome;
  const keepsFindings =
    terminalOutcome === undefined || terminalOutcomeKeepsFindings(terminalOutcome);
  const finalResult: ReviewResult = { issues: keepsFindings ? outcome.issues : [] };

  signal?.throwIfAborted();

  if (!markCommitting(reviewId)) {
    signal?.throwIfAborted();
    return err(reviewAbort("Review is no longer pending.", ReviewErrorCode.CANCELLED));
  }

  const saveResult = await saveReview({
    reviewId,
    projectPath,
    mode,
    result: finalResult,
    diff: parsed,
    branch,
    commit: headCommit,
    profile: profileId,
    lenses: activeLenses,
    durationMs,
    lensStats: outcome.lensStats,
    droppedDuplicates: outcome.droppedDuplicates,
    droppedBelowThreshold: outcome.droppedBelowThreshold,
    minSeverity: outcome.minSeverity,
    ...(outcome.execution ? { execution: outcome.execution } : {}),
  });

  if (!saveResult.ok) {
    return err(reviewAbort(saveResult.error.message, ReviewErrorCode.INTERNAL_ERROR));
  }

  if (!markCommitted(reviewId)) {
    return err(reviewAbort("Review commit state was lost.", ReviewErrorCode.INTERNAL_ERROR));
  }

  // A non-completed terminal outcome is durable first and reported as a failure
  // second: the caller surfaces the error once the receipt is on disk.
  if (terminalOutcome && terminalOutcome !== "completed") {
    if (outcome.terminalDiagnostic) {
      log("warn", "review_execution_failed", {
        reviewId,
        outcome: terminalOutcome,
        diagnosticCode: outcome.terminalDiagnostic.code,
        safeMessage: outcome.terminalDiagnostic.safeMessage,
        remediation: outcome.terminalDiagnostic.remediation,
        correlationId: outcome.terminalDiagnostic.correlationId,
        retryable: outcome.terminalDiagnostic.retryable,
      });
    }
    // A schema failure carries the actionable guidance even when the decisive
    // dispatch produced no diagnostic (the bridge's own PARSE_ERROR path), so
    // the user is never told only that the outcome was `schema-failed`.
    const fallbackMessage =
      terminalOutcome === "schema-failed"
        ? STRUCTURED_OUTPUT_FAILURE_GUIDANCE
        : `Review ended with outcome ${terminalOutcome}.`;
    // The step the abort names is the one the surfaces resolve: without it the
    // report step stays painted as running behind the error.
    return err(
      reviewAbort(
        outcome.terminalDiagnostic?.safeMessage ?? fallbackMessage,
        terminalErrorCode(terminalOutcome, outcome.terminalDiagnostic),
        "report",
      ),
    );
  }

  await emit(stepComplete("report"));
  await emit({
    type: "complete",
    result: finalResult,
    reviewId,
  });
  markComplete(reviewId);

  return ok(finalResult);
}
