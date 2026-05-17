import type { AIClient } from "../../shared/lib/ai/types.js";
import type { ParsedDiff } from "../../shared/lib/diff/types.js";
import { saveReview } from "../../shared/lib/storage/reviews.js";
import {
  type LensId,
  type ProfileId,
  type ReviewMode,
} from "@diffgazer/core/schemas/review";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type {
  ReviewResult,
} from "@diffgazer/core/schemas/review";
import type {
  EnrichProgressEvent,
} from "@diffgazer/core/schemas/events";
import { getSettings } from "../../shared/lib/config/store.js";
import { getProfile } from "../../shared/lib/review/profiles.js";
import { orchestrateReview } from "../../shared/lib/review/orchestrate.js";
import { buildProjectContextSnapshot } from "./context.js";
import { enrichIssues } from "./enrichment.js";
import type { createGitService } from "../../shared/lib/git/service.js";
import { reviewAbort } from "./abort.js";
import {
  type EmitFn,
  type ResolvedConfig,
  type ReviewAbort,
  type ReviewOutcome,
} from "./types.js";
import { type Result, ok, err } from "@diffgazer/core/result";
import { getErrorMessage } from "@diffgazer/core/errors";
import { stepStart, stepComplete } from "./step-events.js";
import { generateReport } from "./summary.js";

export async function resolveReviewConfig(params: {
  lensIds?: LensId[];
  profileId?: ProfileId;
  projectPath: string;
  emit: EmitFn;
}): Promise<ResolvedConfig> {
  const { lensIds, profileId, projectPath, emit } = params;

  const profile = profileId ? getProfile(profileId) : undefined;
  const settings = getSettings();
  const activeLenses = lensIds ??
    profile?.lenses ??
    settings.defaultLenses ?? ["correctness"];

  await emit(stepStart("context"));
  let projectContext = "";
  try {
    const contextSnapshot = await buildProjectContextSnapshot(projectPath);
    projectContext = contextSnapshot.markdown;
  } catch (error) {
    console.warn("[review] project context snapshot failed:", getErrorMessage(error));
    projectContext = "";
  }
  await emit(stepComplete("context"));

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
      concurrency: getSettings().agentExecution === "parallel" ? config.activeLenses.length : 1,
      projectContext: config.projectContext,
      partialOnAllFailed: true,
      signal,
    },
  );

  if (!result.ok) {
    return err(reviewAbort(result.error.message, "AI_ERROR", "review"));
  }

  await emit(stepComplete("review"));

  return ok({ issues: result.value.issues, summary: result.value.summary });
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
  } = params;

  await emit(stepStart("enrich"));

  const enrichedIssues = await enrichIssues(
    outcome.issues,
    gitService,
    async (event: EnrichProgressEvent) => {
      await emit(event);
    },
    signal,
  );

  await emit(stepComplete("enrich"));

  await emit(stepStart("report"));

  const finalResult = generateReport(enrichedIssues, outcome.summary);

  await emit(stepComplete("report"));

  const status = await gitService.getStatus().catch(() => null);
  signal?.throwIfAborted();

  const saveResult = await saveReview({
    reviewId,
    projectPath,
    mode,
    result: finalResult,
    diff: parsed,
    branch: status?.branch ?? null,
    commit: null,
    profile: profileId,
    lenses: activeLenses,
    durationMs: Date.now() - startTime,
  });

  if (!saveResult.ok) {
    return err(reviewAbort(saveResult.error.message, ErrorCode.INTERNAL_ERROR));
  }

  return ok(finalResult);
}
