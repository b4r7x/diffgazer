import { randomUUID } from "node:crypto";
import type { Result } from "@diffgazer/core/result";
import { err, ok } from "@diffgazer/core/result";
import type { FullReviewStreamEvent, StepId } from "@diffgazer/core/schemas/events";
import {
  ReviewErrorCode,
} from "@diffgazer/core/schemas/review";
import type { AIClient } from "../../shared/lib/ai/types.js";
import { createGitService } from "../../shared/lib/git/service.js";
import { log } from "../../shared/lib/log.js";
import { isReviewAbort } from "./abort.js";
import { resolveGitDiff } from "./diff.js";
import {
  executeReview,
  finalizeReview,
  resolveReviewConfig,
} from "./pipeline.js";
import {
  isAbortError,
  normalizeReviewStreamError,
  reviewStreamError,
} from "./stream/events.js";
import { stepError } from "./stream/steps.js";
import {
  type ActiveSession,
  addEvent,
  buildScopeKey,
  cancelStaleSessionsForProjectMode,
  createSession,
  getActiveSessionForProject,
  getSession,
  markComplete,
  markReady,
} from "./stream/store.js";
import type { EmitFn, StreamReviewParams } from "./types.js";

/** Logs per-step latency from the review stream so each phase is observable. */
function logStepTiming(
  event: FullReviewStreamEvent,
  reviewId: string,
  startedAt: Map<StepId, number>,
): void {
  if (event.type === "step_start") {
    startedAt.set(event.step, performance.now());
    return;
  }
  if (event.type === "step_complete" || event.type === "step_error") {
    const started = startedAt.get(event.step);
    if (started === undefined) return;
    startedAt.delete(event.step);
    log(event.type === "step_error" ? "warn" : "info", "review_step", {
      reviewId,
      step: event.step,
      status: event.type === "step_error" ? "error" : "complete",
      durationMs: Math.round((performance.now() - started) * 1000) / 1000,
    });
  }
}

async function handleReviewFailure(
  error: unknown,
  emit: EmitFn,
  reviewId: string,
): Promise<void> {
  if (isAbortError(error)) {
    markComplete(reviewId);
    return;
  }

  if (isReviewAbort(error)) {
    if (error.step) {
      await emit(stepError(error.step, error.message));
    }
    await emit(reviewStreamError(error.message, error.code));
    markComplete(reviewId);
    return;
  }

  const normalized = normalizeReviewStreamError(error);
  await emit(reviewStreamError(normalized.message, normalized.code));
  markComplete(reviewId);
}

function handleDetachedReviewSessionError(reviewId: string, error: unknown): void {
  const session = getSession(reviewId);
  if (!session || session.isComplete) {
    return;
  }

  const normalized = normalizeReviewStreamError(error);
  addEvent(reviewId, reviewStreamError(normalized.message, normalized.code));
  markComplete(reviewId);
}

export interface CreateReviewSessionResult {
  reviewId: string;
  session: ActiveSession;
}

export async function createReviewSession(
  aiClient: AIClient,
  options: StreamReviewParams,
): Promise<Result<CreateReviewSessionResult, { code: string; message: string }>> {
  const { mode = "unstaged", files, lenses: lensIds, profile: profileId, projectPath: projectPathOption } = options;
  const projectPath = projectPathOption ?? process.cwd();
  const gitService = createGitService({ cwd: projectPath });

  const [headCommitResult, statusHashResult] = await Promise.all([
    gitService.getHeadCommit(),
    gitService.getStatusHash(),
  ]);

  if (!headCommitResult.ok) {
    return err({
      code: ReviewErrorCode.GENERATION_FAILED,
      message: `Failed to inspect repository state: ${headCommitResult.error.message}`,
    });
  }

  const headCommit = headCommitResult.value;
  const statusHash = statusHashResult ?? "";
  const scopeKey = buildScopeKey({ files, lenses: lensIds, profile: profileId });

  if (headCommit && statusHashResult !== null) {
    const existingSession = getActiveSessionForProject(projectPath, { headCommit, statusHash, mode, scopeKey });
    if (existingSession) {
      return ok({ reviewId: existingSession.reviewId, session: existingSession });
    }
  }

  cancelStaleSessionsForProjectMode(projectPath, mode, headCommit, statusHash);

  const reviewId = randomUUID();
  const session = createSession(reviewId, { projectPath, headCommit, statusHash, mode, scopeKey });
  markReady(reviewId);

  void runReviewSession(
    aiClient,
    { mode, files, lenses: lensIds, profile: profileId, projectPath },
    reviewId,
    session.controller.signal,
  ).catch((error) => {
    handleDetachedReviewSessionError(reviewId, error);
  });

  return ok({ reviewId, session });
}

async function runReviewSession(
  aiClient: AIClient,
  options: StreamReviewParams,
  reviewId: string,
  signal: AbortSignal,
): Promise<void> {
  const {
    mode = "unstaged",
    files,
    lenses: lensIds,
    profile: profileId,
    projectPath: projectPathOption,
  } = options;
  const startTime = Date.now();
  const projectPath = projectPathOption ?? process.cwd();
  const gitService = createGitService({ cwd: projectPath });

  const stepStartedAt = new Map<StepId, number>();
  const emit: EmitFn = async (event) => {
    if (signal.aborted) return;
    logStepTiming(event, reviewId, stepStartedAt);
    addEvent(reviewId, event);
  };

  try {
    const parsedResult = await resolveGitDiff({ gitService, mode, files, emit, reviewId });
    if (!parsedResult.ok) {
      await handleReviewFailure(parsedResult.error, emit, reviewId);
      return;
    }
    const parsed = parsedResult.value;

    const config = await resolveReviewConfig({ lensIds, profileId, projectPath, emit });

    const outcomeResult = await executeReview({ aiClient, parsed, config, emit, signal });
    if (!outcomeResult.ok) {
      await handleReviewFailure(outcomeResult.error, emit, reviewId);
      return;
    }
    const outcome = outcomeResult.value;

    const headCommitResult = await gitService.getHeadCommit();
    const headCommit = headCommitResult.ok ? headCommitResult.value : undefined;

    const finalResultResult = await finalizeReview({
      outcome, gitService, emit, reviewId, projectPath, mode,
      parsed, profileId, activeLenses: config.activeLenses, startTime, signal,
      headCommit,
    });
    if (!finalResultResult.ok) {
      await handleReviewFailure(finalResultResult.error, emit, reviewId);
      return;
    }
    const finalResult = finalResultResult.value;

    await emit({
      type: "complete",
      result: finalResult,
      reviewId,
      durationMs: Date.now() - startTime,
    });
    markComplete(reviewId);
  } catch (error) {
    await handleReviewFailure(error, emit, reviewId);
  }
}
