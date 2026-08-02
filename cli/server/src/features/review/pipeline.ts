import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { SettingsConfig } from "@diffgazer/core/schemas/config";
import { severityRank } from "@diffgazer/core/schemas/presentation";
import {
  type ExecutionResult,
  ExecutionResultSchema,
  type LensId,
  type ProfileId,
  ReviewErrorCode,
  ReviewErrorSchema,
  type ReviewMode,
  type ReviewResult,
  type ReviewSeverity,
  type SeverityFilter,
  type TerminalOutcome,
} from "@diffgazer/core/schemas/review";
import type { AuthorizedReviewExecution } from "../../shared/lib/ai/admission/service.js";
import { buildExecutionResult } from "../../shared/lib/ai/client/generate.js";
import type { AIClient } from "../../shared/lib/ai/types.js";
import { getStore } from "../../shared/lib/config/store.js";
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
import { createReviewExecutionContext } from "./types.js";

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
  settings?: SettingsConfig;
}): ResolvedReviewDefaults {
  const settings = params.settings ?? getStore().getSettings();
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
  emit: EmitFn;
  signal?: AbortSignal;
}): Promise<ResolvedConfig> {
  const { defaults, projectPath, emit, signal } = params;

  signal?.throwIfAborted();
  await emit(stepStart("context"));
  signal?.throwIfAborted();
  let projectContext = "";
  try {
    const contextSnapshot = await buildProjectContextSnapshot(projectPath);
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

export function prohibitPartialFindings(outcome: ReviewOutcome): ReviewOutcome {
  if (!outcome.execution || outcome.execution.receipt.outcome === "completed") {
    return outcome;
  }
  return {
    ...outcome,
    issues: [],
    execution: ExecutionResultSchema.parse({
      receipt: outcome.execution.receipt,
      result: { issues: [] },
    }),
  };
}

export function releaseReviewExecutionResources(context: ReviewExecutionContext): void {
  context.releaseOnce();
}

/** A client whose dispatches are observable, so the review can report what the adapter returned. */
type ReviewAIClient = AIClient & {
  authorization?: AuthorizedReviewExecution;
  terminalExecutions?: readonly ExecutionResult[];
};

function resolveExecutionContext(
  aiClient: ReviewAIClient,
  executionContext?: ReviewExecutionContext,
): ReviewExecutionContext | null {
  if (executionContext) return executionContext;
  if (!aiClient.authorization) return null;
  return createReviewExecutionContext(aiClient.authorization);
}

function mapOrchestrationErrorToTerminalOutcome(error: { code: string }): TerminalOutcome {
  if (error.code === "PARSE_ERROR") return "schema-failed";
  return "transport-failed";
}

/** The receipt whose outcome a failed review reports: the first failed dispatch. */
function failedDispatch(
  executions: readonly ExecutionResult[],
): ExecutionResult["receipt"] | undefined {
  return executions.find((execution) => execution.receipt.outcome !== "completed")?.receipt;
}

/** The receipt whose usage a completed review reports: the last dispatch that reported any. */
function reportedDispatch(
  executions: readonly ExecutionResult[],
): ExecutionResult["receipt"] | undefined {
  return executions.findLast((execution) => execution.receipt.usageAvailability === "reported")
    ?.receipt;
}

export async function executeReview(params: {
  aiClient: ReviewAIClient;
  parsed: ParsedDiff;
  config: ResolvedConfig;
  emit: EmitFn;
  signal?: AbortSignal;
  executionContext?: ReviewExecutionContext;
}): Promise<Result<ReviewOutcome, ReviewAbort>> {
  const { aiClient, parsed, config, emit, signal, executionContext: providedContext } = params;
  const executionContext = resolveExecutionContext(aiClient, providedContext);
  const startedAt = new Date().toISOString();

  await emit(stepStart("review"));

  if (signal?.aborted && executionContext) {
    const execution = buildExecutionResult(executionContext.authorization.plan, "cancelled", {
      startedAt,
      attemptCount: 0,
    });
    return ok(prohibitPartialFindings({ issues: [], execution }));
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
      const failed = failedDispatch(dispatched);
      const execution = buildExecutionResult(
        executionContext.authorization.plan,
        failed?.outcome ?? mapOrchestrationErrorToTerminalOutcome(result.error),
        {
          startedAt,
          finishedAt,
          attemptCount: failed?.attemptCount ?? 1,
          usageAvailability: failed?.usageAvailability,
          usage: failed?.usage,
        },
      );
      return ok(
        prohibitPartialFindings({
          issues: [],
          execution,
        }),
      );
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

  let outcome: ReviewOutcome = {
    issues: result.value.issues,
    lensStats: result.value.lensStats,
    droppedDuplicates: result.value.droppedDuplicates,
    droppedBelowThreshold: result.value.droppedBelowThreshold,
    minSeverity: result.value.minSeverity,
  };

  if (executionContext) {
    const reported = reportedDispatch(dispatched);
    outcome.execution = buildExecutionResult(executionContext.authorization.plan, "completed", {
      startedAt,
      finishedAt,
      issues: result.value.issues,
      usageAvailability: reported?.usageAvailability,
      usage: reported?.usage,
    });
    outcome = prohibitPartialFindings(outcome);
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
    outcome: rawOutcome,
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

  const outcome = prohibitPartialFindings(rawOutcome);

  await emit(stepStart("report"));

  const finalResult: ReviewResult = { issues: outcome.issues };

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
  const terminalOutcome = outcome.execution?.receipt.outcome;
  if (terminalOutcome && terminalOutcome !== "completed") {
    return err(
      reviewAbort(`Review ended with outcome ${terminalOutcome}.`, ReviewErrorCode.AI_ERROR),
    );
  }

  await emit(stepComplete("report"));
  await emit({
    type: "complete",
    result: finalResult,
    reviewId,
    durationMs,
  });
  markComplete(reviewId);

  return ok(finalResult);
}
