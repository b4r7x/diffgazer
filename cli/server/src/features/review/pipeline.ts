import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { SettingsConfig } from "@diffgazer/core/schemas/config";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type {
  EnrichProgressEvent,
} from "@diffgazer/core/schemas/events";
import type {
  LensId,
  ProfileId,
  ReviewMode,
  ReviewResult,
} from "@diffgazer/core/schemas/review";
import type { AIClient } from "../../shared/lib/ai/types.js";
import { getStore } from "../../shared/lib/config/store.js";
import type { ParsedDiff } from "../../shared/lib/diff/types.js";
import type { createGitService } from "../../shared/lib/git/service.js";
import { orchestrateReview } from "../../shared/lib/review/orchestrate.js";
import { getProfile } from "../../shared/lib/review/profiles.js";
import { saveReview } from "../../shared/lib/storage/reviews.js";
import { reviewAbort } from "./abort.js";
import { buildProjectContextSnapshot } from "./context/snapshot.js";
import { enrichIssues } from "./enrichment.js";
import { stepComplete, stepError, stepStart } from "./stream/steps.js";
import { generateReport } from "./summary.js";
import type {
  EmitFn,
  ResolvedConfig,
  ReviewAbort,
  ReviewOutcome,
} from "./types.js";

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

export async function resolveReviewConfig(params: {
  lensIds?: LensId[];
  profileId?: ProfileId;
  projectPath: string;
  emit: EmitFn;
}): Promise<ResolvedConfig> {
  const { lensIds, profileId, projectPath, emit } = params;

  const profile = profileId ? getProfile(profileId) : undefined;
  const settings = getStore().getSettings();
  const activeLenses = resolveActiveLenses(lensIds, profile, settings);

  await emit(stepStart("context"));
  let projectContext = "";
  try {
    const contextSnapshot = await buildProjectContextSnapshot(projectPath);
    projectContext = contextSnapshot.markdown;
    await emit(stepComplete("context"));
  } catch (error) {
    console.warn("[review] project context snapshot failed:", getErrorMessage(error));
    projectContext = "";
    await emit(stepError("context", `Context build failed: ${getErrorMessage(error)}`));
  }

  return { activeLenses, profile, projectContext };
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
      filter: config.profile?.filter,
    },
    async (event) => {
      await emit(event);
    },
    {
      concurrency: getStore().getSettings().agentExecution === "parallel" ? config.activeLenses.length : 1,
      projectContext: config.projectContext,
      partialOnAllFailed: false,
      signal,
    },
  );

  if (!result.ok) {
    return err(reviewAbort(result.error.message, "AI_ERROR", "review"));
  }

  await emit(stepComplete("review"));

  return ok({ issues: result.value.issues, summary: result.value.summary, lensStats: result.value.lensStats });
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

  await emit(stepStart("enrich"));

  const reviewedFiles = new Set(parsed.files.map((f) => f.filePath));
  const enrichedIssues = await enrichIssues(
    outcome.issues,
    gitService,
    async (event: EnrichProgressEvent) => {
      await emit(event);
    },
    signal,
    reviewedFiles,
  );

  await emit(stepComplete("enrich"));

  await emit(stepStart("report"));

  const finalResult = generateReport(enrichedIssues, outcome.summary);

  await emit(stepComplete("report"));

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
  });

  if (!saveResult.ok) {
    return err(reviewAbort(saveResult.error.message, ErrorCode.INTERNAL_ERROR));
  }

  return ok(finalResult);
}
