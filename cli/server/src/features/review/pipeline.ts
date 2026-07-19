import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { SettingsConfig } from "@diffgazer/core/schemas/config";
import { severityRank } from "@diffgazer/core/schemas/presentation";
import {
  type LensId,
  type ProfileId,
  ReviewErrorCode,
  ReviewErrorSchema,
  type ReviewMode,
  type ReviewResult,
  type ReviewSeverity,
  type SeverityFilter,
} from "@diffgazer/core/schemas/review";
import type { AIClient } from "../../shared/lib/ai/types.js";
import { getStore } from "../../shared/lib/config/store.js";
import { log } from "../../shared/lib/log.js";
import { type ReviewAbort, reviewAbort } from "./abort.js";
import { buildProjectContextSnapshot } from "./context/snapshot.js";
import type { ParsedDiff } from "./engine/diff/types.js";
import { orchestrateReview } from "./engine/orchestrate.js";
import { getProfile } from "./engine/profiles.js";
import { saveReview } from "./storage/reviews.js";
import { stepComplete, stepError, stepStart } from "./stream/steps.js";
import { markCommitted, markCommitting, markComplete } from "./stream/store.js";
import type { EmitFn, ResolvedConfig, ResolvedReviewDefaults, ReviewOutcome } from "./types.js";

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

export async function executeReview(params: {
  aiClient: AIClient;
  parsed: ParsedDiff;
  config: ResolvedConfig;
  emit: EmitFn;
  signal?: AbortSignal;
}): Promise<Result<ReviewOutcome, ReviewAbort>> {
  const { aiClient, parsed, config, emit, signal } = params;

  await emit(stepStart("review"));

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
      partialOnAllFailed: false,
      signal,
    },
  );

  if (!result.ok) {
    const classified = ReviewErrorSchema.safeParse(result.error);
    return err(
      reviewAbort(
        result.error.message,
        classified.success ? classified.data.code : ReviewErrorCode.AI_ERROR,
        "review",
      ),
    );
  }

  await emit(stepComplete("review"));

  return ok({
    issues: result.value.issues,
    lensStats: result.value.lensStats,
    droppedDuplicates: result.value.droppedDuplicates,
    droppedBelowThreshold: result.value.droppedBelowThreshold,
    minSeverity: result.value.minSeverity,
  });
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

  // outcome.issues are already deduplicated, severity-filtered, and
  // completeness-validated inside orchestrateReview; no second filter pass.
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
  });

  if (!saveResult.ok) {
    return err(reviewAbort(saveResult.error.message, ReviewErrorCode.INTERNAL_ERROR));
  }

  if (!markCommitted(reviewId)) {
    return err(reviewAbort("Review commit state was lost.", ReviewErrorCode.INTERNAL_ERROR));
  }

  // Complete the report step only after the durable save — so a save failure
  // never emits report=completed, and the client's View Results gate stays
  // truthful (the terminal `complete` signal is the equivalent guard).
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
