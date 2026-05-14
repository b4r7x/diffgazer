import { randomUUID } from "node:crypto";
import { createGitService } from "../../shared/lib/git/service.js";
import type { AIClient } from "../../shared/lib/ai/types.js";
import {
  ReviewErrorCode,
} from "@diffgazer/core/schemas/review";
import type { Result } from "@diffgazer/core/result";
import { ok, err } from "@diffgazer/core/result";
import {
  createSession,
  markReady,
  addEvent,
  markComplete,
  getActiveSessionForProject,
  getSession,
  cancelStaleSessionsForProjectMode,
  type ActiveSession,
} from "./sessions.js";
import type { EmitFn, StreamReviewParams } from "./types.js";
import {
  resolveReviewConfig,
  executeReview,
  finalizeReview,
} from "./pipeline.js";
import { resolveGitDiff } from "./diff.js";
import { isReviewAbort } from "./abort.js";
import { stepError } from "./step-events.js";
import {
  isAbortError,
  normalizeReviewStreamError,
  reviewStreamError,
} from "./stream-events.js";

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

  const [headCommitResult, statusHash] = await Promise.all([
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

  if (headCommit) {
    const existingSession = getActiveSessionForProject(projectPath, headCommit, statusHash, mode);
    if (existingSession) {
      return ok({ reviewId: existingSession.reviewId, session: existingSession });
    }
  }

  cancelStaleSessionsForProjectMode(projectPath, mode, headCommit, statusHash);

  const reviewId = randomUUID();
  const session = createSession(reviewId, projectPath, headCommit, statusHash, mode);
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

  const emit: EmitFn = async (event) => {
    if (signal.aborted) return;
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

    const finalResultResult = await finalizeReview({
      outcome, gitService, emit, reviewId, projectPath, mode,
      parsed, profileId, activeLenses: config.activeLenses, startTime, signal,
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
