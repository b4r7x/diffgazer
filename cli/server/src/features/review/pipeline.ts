import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { SettingsConfig } from "@diffgazer/core/schemas/config";
import { severityRank } from "@diffgazer/core/schemas/presentation";
import {
  type LensId,
  type ProfileId,
  ReviewErrorCode,
  type ReviewMode,
  type ReviewResult,
  type ReviewSeverity,
  type SeverityFilter,
} from "@diffgazer/core/schemas/review";
import type { AIClient } from "../../shared/lib/ai/types.js";
import { getStore } from "../../shared/lib/config/store.js";
import type { createGitService } from "../../shared/lib/git/service.js";
import { log } from "../../shared/lib/log.js";
import { reviewAbort } from "./abort.js";
import { buildProjectContextSnapshot } from "./context/snapshot.js";
import type { ParsedDiff } from "./engine/diff/types.js";
import { orchestrateReview } from "./engine/orchestrate.js";
import { getProfile } from "./engine/profiles.js";
import { saveReview } from "./storage/reviews.js";
import { stepComplete, stepError, stepStart } from "./stream/steps.js";
import { generateReport } from "./summary.js";
import type { EmitFn, ResolvedConfig, ReviewAbort, ReviewOutcome } from "./types.js";

const DEFAULT_LENSES: LensId[] = ["correctness"];

/** Resolve the active lenses using an explicit ordered fallback. */
function resolveActiveLenses(
  lensIds: LensId[] | undefined,
  profile: ReturnType<typeof getProfile> | undefined,
  settings: SettingsConfig,
): LensId[] {
  if (lensIds) return lensIds;
  if (profile?.lenses) return profile.lenses;
  if (settings.defaultLenses) return settings.defaultLenses;
  return DEFAULT_LENSES;
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
}): Omit<ResolvedConfig, "projectContext"> {
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
  };
}

export async function resolveReviewConfig(params: {
  lensIds?: LensId[];
  profileId?: ProfileId;
  projectPath: string;
  emit: EmitFn;
}): Promise<ResolvedConfig> {
  const { projectPath, emit } = params;
  const defaults = resolveReviewDefaults(params);

  await emit(stepStart("context"));
  let projectContext = "";
  try {
    const contextSnapshot = await buildProjectContextSnapshot(projectPath);
    projectContext = contextSnapshot.markdown;
    await emit(stepComplete("context"));
  } catch (error) {
    log("warn", "review_context_snapshot_failed", { error: getErrorMessage(error) });
    projectContext = "";
    await emit(stepError("context", `Context build failed: ${getErrorMessage(error)}`));
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
      concurrency:
        getStore().getSettings().agentExecution === "parallel" ? config.activeLenses.length : 1,
      projectContext: config.projectContext,
      partialOnAllFailed: false,
      signal,
    },
  );

  if (!result.ok) {
    return err(reviewAbort(result.error.message, ReviewErrorCode.AI_ERROR, "review"));
  }

  await emit(stepComplete("review"));

  return ok({
    issues: result.value.issues,
    summary: result.value.summary,
    lensStats: result.value.lensStats,
    droppedDuplicates: result.value.droppedDuplicates,
    droppedBelowThreshold: result.value.droppedBelowThreshold,
    minSeverity: result.value.minSeverity,
  });
}

export async function finalizeReview(params: {
  outcome: ReviewOutcome;
  gitService: ReturnType<typeof createGitService>;
  emit: EmitFn;
  reviewId: string;
  projectPath: string;
  mode: ReviewMode;
  parsed: ParsedDiff;
  profileId?: ProfileId;
  activeLenses: LensId[];
  startTime: number;
  signal?: AbortSignal;
  headCommit?: string;
}): Promise<Result<ReviewResult, ReviewAbort>> {
  const {
    outcome,
    gitService,
    emit,
    reviewId,
    projectPath,
    mode,
    parsed,
    profileId,
    activeLenses,
    startTime,
    signal,
    headCommit,
  } = params;

  await emit(stepStart("report"));

  // outcome.issues are already deduplicated, severity-filtered, and
  // completeness-validated inside orchestrateReview; no second filter pass.
  const finalResult = generateReport(outcome.issues, outcome.summary);

  const statusResult = await gitService.getStatus().catch(() => null);
  signal?.throwIfAborted();
  const status = statusResult?.ok ? statusResult.value : null;

  const saveResult = await saveReview({
    reviewId,
    projectPath,
    mode,
    result: finalResult,
    diff: parsed,
    branch: status?.branch ?? null,
    commit: headCommit ?? null,
    profile: profileId,
    lenses: activeLenses,
    durationMs: Date.now() - startTime,
    lensStats: outcome.lensStats,
    droppedDuplicates: outcome.droppedDuplicates,
    droppedBelowThreshold: outcome.droppedBelowThreshold,
    minSeverity: outcome.minSeverity,
  });

  if (!saveResult.ok) {
    return err(reviewAbort(saveResult.error.message, ReviewErrorCode.INTERNAL_ERROR));
  }

  // Complete the report step only after the durable save — so a save failure
  // never emits report=completed, and the client's View Results gate stays
  // truthful (the terminal `complete` signal is the equivalent guard).
  await emit(stepComplete("report"));

  return ok(finalResult);
}
