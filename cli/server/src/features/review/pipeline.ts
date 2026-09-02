import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { SettingsConfig } from "@diffgazer/core/schemas/config";
import {
  type ExecutionResult,
  type NormalizedUsage,
  NormalizedUsageSchema,
  type ProfileId,
  REVIEW_WALL_CEILING_SLACK,
  ReviewErrorCode,
  ReviewErrorSchema,
  type ReviewMode,
  type ReviewResult,
  type ReviewSeverity,
  type SelectableLensId,
  type SeverityFilter,
  severityRank,
  type TerminalOutcome,
  terminalOutcomeKeepsFindings,
  type UsageAvailability,
} from "@diffgazer/core/schemas/review";
import type { AuthorizedReviewExecution } from "../../shared/lib/ai/admission/service.js";
import { estimateWorstCaseCostUsd } from "../../shared/lib/ai/budget/cost.js";
import {
  budgetExhaustedMessage,
  buildExecutionResult,
  normalizeBuildExecutionUsageInput,
} from "../../shared/lib/ai/client/generate.js";
import { composeExecutionDeadline } from "../../shared/lib/ai/deadline.js";
import {
  PROVIDER_REJECTED_DIAGNOSTIC_CODE,
  serializeFailureDiagnostic,
} from "../../shared/lib/ai/diagnostics.js";
import { resolveDispatchPacing } from "../../shared/lib/ai/providers/hosted/profiles.js";
import type { AIClient, AIErrorDiagnostic } from "../../shared/lib/ai/types.js";
import { log } from "../../shared/lib/log.js";
import { type ReviewAbort, reviewAbort } from "./abort.js";
import type { ReviewCapacityPlan } from "./capacity.js";
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
  lensIds: SelectableLensId[] | undefined,
  profile: ReturnType<typeof getProfile> | undefined,
  settings: SettingsConfig,
): SelectableLensId[] {
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
  lensIds?: SelectableLensId[];
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
 * The receipt whose outcome a failed review reports. A schema-failed receipt is
 * decisive only when the orchestration's own verdict was structured output —
 * every lens schema-failed, or the schema bridge rejected the response itself
 * (then the review reports no dispatch receipt at all). A mixed all-failed run
 * reports the non-schema dispatch that names its real cause, so one schema
 * flake among transport failures never reads as model incapacity.
 */
function failedDispatch(
  executions: readonly ExecutionResult[],
  error: { code: string; allLensesSchemaFailed?: true },
): ExecutionResult["receipt"] | undefined {
  if (
    error.allLensesSchemaFailed === true ||
    mapOrchestrationErrorToTerminalOutcome(error) === "schema-failed"
  ) {
    return executions.find((execution) => execution.receipt.outcome === "schema-failed")?.receipt;
  }
  return (
    executions.find(
      (execution) =>
        execution.receipt.outcome !== "completed" && execution.receipt.outcome !== "schema-failed",
    )?.receipt ?? executions.find((execution) => execution.receipt.outcome !== "completed")?.receipt
  );
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

function totalAttemptCount(executions: readonly ExecutionResult[]): number {
  if (executions.length === 0) return 1;
  return executions.reduce((sum, execution) => sum + execution.receipt.attemptCount, 0);
}

/**
 * Headroom over the plan's estimate. The estimate prices the diff the prompts
 * carry, not the retries a lens may take, the answers the review bills for on
 * top of them, or the one synthesis pass a batched review closes with. Bound to
 * the receipt schema's review wall-ceiling slack so a raised envelope — the
 * wall clock included — can never outgrow what a review-scope receipt accepts.
 */
const BATCHED_ENVELOPE_HEADROOM = REVIEW_WALL_CEILING_SLACK;

/**
 * Opens the review's ledger reservation at what the review actually spends.
 * Admission projected the envelope for one call on the configured base; a plan
 * the size gate split into batches costs a multiple of it, and admitting the
 * review only to exhaust it two lenses in would turn "too large for one call"
 * into "budget exhausted mid-review". The wall dimension is raised for every
 * review: it is an elapsed clock sized to the sequential worst case of the
 * calls the plan dispatches, so a wrong concurrency guess or provider-side
 * queueing can never expire it into a false budget-exhausted death; parallel
 * runs just finish with clock to spare.
 *
 * The size axes are raised; the per-review spend cap is not. It is the user's
 * money, so a batched plan whose worst case runs past it is refused here,
 * before the first dispatch, rather than stopped halfway through.
 */
function scaleBudgetEnvelope(
  executionContext: ReviewExecutionContext,
  capacity: ReviewCapacityPlan | undefined,
  reviewCallCount: number,
  reviewWallTimeCapMs: number | null,
): ReviewAbort | null {
  const { budgetLedger, budgetReservation, plan } = executionContext.authorization;
  const configuredBase = budgetLedger.limits;
  const batched = capacity !== undefined && capacity.batches.length > 1;

  let scaledInputTokens = configuredBase.maxInputTokens;
  let scaledResponseBytes = configuredBase.maxResponseBytes;
  if (batched) {
    scaledInputTokens = Math.max(
      configuredBase.maxInputTokens,
      Math.ceil(capacity.estimatedTotalInputTokens * BATCHED_ENVELOPE_HEADROOM),
    );
    const scaleFactor = scaledInputTokens / configuredBase.maxInputTokens;
    scaledResponseBytes = Math.ceil(configuredBase.maxResponseBytes * scaleFactor);

    const worstCaseCostUsd = estimateWorstCaseCostUsd(
      plan.productId,
      plan.evidenceKey.modelId,
      { maxInputTokens: scaledInputTokens },
      reviewCallCount,
    );
    if (worstCaseCostUsd !== null && worstCaseCostUsd > configuredBase.maxCostUsd) {
      return reviewAbort(
        `This review needs ${capacity.batches.length} batches per lens, which can bill up to ` +
          `$${worstCaseCostUsd.toFixed(2)} against your $${configuredBase.maxCostUsd.toFixed(2)} ` +
          `per-review spend cap. Review fewer files at a time, or raise the cap.`,
        ReviewErrorCode.DIFF_TOO_LARGE,
        // The step the abort names is the one the surfaces resolve, and this
        // refusal is raised after `executeReview` started the review step: the
        // diff step is long since complete.
        "review",
      );
    }
  }

  // The user's cap trims the derived envelope but never below one dispatch
  // wall: a review must be able to run one call.
  const derivedWallMs = Math.ceil(
    plan.limits.wallTimeMs * reviewCallCount * BATCHED_ENVELOPE_HEADROOM,
  );
  const capMs = reviewWallTimeCapMs ?? Number.POSITIVE_INFINITY;
  const reviewWallTimeMs = Math.max(plan.limits.wallTimeMs, Math.min(derivedWallMs, capMs));

  budgetLedger.raiseReviewEnvelope(budgetReservation, {
    inputTokens: scaledInputTokens,
    responseBytes: scaledResponseBytes,
    wallTimeMs: reviewWallTimeMs,
  });
  return null;
}

export async function executeReview(params: {
  aiClient: ReviewAIClient;
  parsed: ParsedDiff;
  config: ResolvedConfig;
  emit: EmitFn;
  signal?: AbortSignal;
  executionContext?: ReviewExecutionContext;
  /**
   * The size gate's dispatch plan. Absent is an unbatched review on the
   * configured envelope: the diff read whole, in one call per lens.
   */
  capacity?: ReviewCapacityPlan;
  /** The user's ceiling on the review's elapsed wall; `null` keeps the derived envelope. */
  reviewWallTimeCapMs?: number | null;
}): Promise<Result<ReviewOutcome, ReviewAbort>> {
  const { aiClient, parsed, config, emit, signal, executionContext, capacity } = params;
  const reviewWallTimeCapMs = params.reviewWallTimeCapMs ?? null;
  const startedAt = new Date().toISOString();

  await emit(stepStart("review"));

  if (signal?.aborted && executionContext) {
    const execution = buildExecutionResult(executionContext.authorization.plan, "cancelled", {
      startedAt,
      attemptCount: 0,
    });
    return ok({ issues: [], execution });
  }

  const plan = executionContext?.authorization.plan;
  const pacing = plan ? resolveDispatchPacing(plan.productId, plan.evidenceKey.modelId) : {};
  const effectiveConcurrency = Math.min(
    config.concurrency,
    pacing.maxParallelDispatches ?? Number.POSITIVE_INFINITY,
  );

  let reviewClock: ReturnType<typeof composeExecutionDeadline> | undefined;
  if (executionContext) {
    // Every lens reads every batch, and a multi-batch run closes with one
    // synthesis; a single-batch review is one call per lens.
    const batchCount = capacity?.batches.length ?? 1;
    const reviewCallCount =
      batchCount > 1 ? batchCount * config.activeLenses.length + 1 : config.activeLenses.length;
    const abort = scaleBudgetEnvelope(
      executionContext,
      capacity,
      reviewCallCount,
      reviewWallTimeCapMs,
    );
    if (abort) return err(abort);

    // The review's elapsed wall clock, started on the raised envelope. The
    // ledger refuses any dispatch the remaining clock cannot fit, and the
    // clock's signal aborts the ones in flight when it runs out.
    reviewClock = composeExecutionDeadline(
      executionContext.authorization.budgetLedger.limits.wallTimeMs,
    );
    executionContext.authorization.budgetLedger.attachReviewClock(
      reviewClock,
      executionContext.authorization.plan.limits.wallTimeMs,
    );
  }

  let result: Awaited<ReturnType<typeof orchestrateReview>>;
  try {
    result = await orchestrateReview(
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
        concurrency: effectiveConcurrency,
        ...(effectiveConcurrency < config.concurrency
          ? { requestedConcurrency: config.concurrency }
          : {}),
        ...(plan ? { dispatchWallTimeMs: plan.limits.wallTimeMs } : {}),
        ...(reviewClock ? { reviewClock } : {}),
        ...(capacity ? { batches: capacity.batches } : {}),
        projectContext: config.projectContext,
        signal,
      },
    );
  } finally {
    reviewClock?.dispose();
  }

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
      // An expired review clock is decisive even when every dispatch receipt
      // says `cancelled`: the clock is why they were cancelled.
      const wallClockExpired = reviewClock?.expired() === true;
      const terminalOutcome = wallClockExpired
        ? "budget-exhausted"
        : (failed?.outcome ?? mapOrchestrationErrorToTerminalOutcome(result.error));
      const usage = aggregateUsageState(dispatched, terminalOutcome, failed?.usageAvailability);
      const execution = buildExecutionResult(executionContext.authorization.plan, terminalOutcome, {
        startedAt,
        finishedAt,
        attemptCount: totalAttemptCount(dispatched),
        scope: "review",
        dispatchCount: Math.max(1, dispatched.length),
        ...normalizeBuildExecutionUsageInput(usage),
      });
      const operativeLimits = executionContext.authorization.budgetLedger.limits;
      const terminalDiagnostic = wallClockExpired
        ? serializeFailureDiagnostic({
            code: "budget-exhausted",
            message: budgetExhaustedMessage(
              "wallTimeMs",
              operativeLimits.wallTimeMs,
              Date.parse(finishedAt) - Date.parse(startedAt),
            ),
            remediation: "Reduce review scope or increase configured limits.",
          })
        : terminalDiagnosticForDispatch(dispatched, aiClient.terminalDiagnostics, failed);
      return ok({
        issues: [],
        execution,
        terminalDiagnostic,
        ...(result.error.lensStats.length > 0 ? { lensStats: result.error.lensStats } : {}),
      });
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
    outcome.execution = buildExecutionResult(executionContext.authorization.plan, reviewOutcome, {
      startedAt,
      finishedAt,
      attemptCount: totalAttemptCount(dispatched),
      scope: "review",
      dispatchCount: Math.max(1, dispatched.length),
      issues: result.value.issues,
      ...normalizeBuildExecutionUsageInput(aggregateUsageState(dispatched, reviewOutcome)),
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
  activeLenses: SelectableLensId[];
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
    // A schema failure still names the failure and the way out when the
    // decisive dispatch produced no diagnostic (the bridge's own PARSE_ERROR
    // path) — but not the memo's "fail immediately" sentence, because a
    // diagnosticless schema failure never arms the fail-fast memo.
    const fallbackMessage =
      terminalOutcome === "schema-failed"
        ? "This model could not produce Diffgazer's structured review output. Change the model or update the configuration."
        : `Review ended with outcome ${terminalOutcome}.`;
    // The diagnostic's remediation is part of the user-facing message: the
    // screen-level guidance is generic per error code, and "what to do now"
    // (wait, switch Agent Execution to Sequential, fix the key) lives here.
    const diagnosticMessage = outcome.terminalDiagnostic
      ? [outcome.terminalDiagnostic.safeMessage, outcome.terminalDiagnostic.remediation]
          .filter((part) => part && part !== "none")
          .join(" ")
      : fallbackMessage;
    // The step the abort names is the one the surfaces resolve: without it the
    // report step stays painted as running behind the error.
    return err(
      reviewAbort(
        diagnosticMessage,
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
