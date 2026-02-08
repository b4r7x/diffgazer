import { randomUUID } from "node:crypto";
import { createGitService } from "../../shared/lib/git/service.js";
import type { AIClient } from "../../shared/lib/ai/types.js";
import { getErrorMessage } from "@stargazer/core/errors";
import {
  ReviewErrorCode,
  type ReviewErrorCode as ReviewErrorCodeType,
  type ReviewMode,
} from "@stargazer/schemas/review";
import type { SSEWriter } from "../../shared/lib/http/sse.js";
import type { StepId, FullReviewStreamEvent } from "@stargazer/schemas/events";
import {
  createSession,
  markReady,
  addEvent,
  markComplete,
  subscribe,
  getActiveSessionForProject,
  getSession,
  cancelStaleSessionsForProjectMode,
  type ActiveSession,
} from "./sessions.js";
import type { EmitFn, StreamReviewParams } from "./types.js";
import {
  resolveGitDiff,
  resolveReviewConfig,
  executeReview,
  finalizeReview,
} from "./pipeline.js";
import { isReviewAbort } from "./utils.js";
import type { ReviewAbort } from "./types.js";

const REVIEW_STREAM_ERROR_CODES = new Set(Object.values(ReviewErrorCode));

function isReviewStreamErrorCode(
  code: string
): code is (typeof ReviewErrorCode)[keyof typeof ReviewErrorCode] {
  return REVIEW_STREAM_ERROR_CODES.has(
    code as (typeof ReviewErrorCode)[keyof typeof ReviewErrorCode]
  );
}

function stepError(step: StepId, error: string): { type: "step_error"; step: StepId; error: string; timestamp: string } {
  return { type: "step_error", step, error, timestamp: new Date().toISOString() };
}

async function writeStreamEvent(stream: SSEWriter, event: FullReviewStreamEvent): Promise<void> {
  await stream.writeSSE({
    event: event.type,
    data: JSON.stringify(event),
  });
}

function normalizeReviewErrorCode(
  code: unknown,
  fallback: ReviewErrorCodeType = ReviewErrorCode.GENERATION_FAILED,
): ReviewErrorCodeType {
  if (typeof code === "string" && isReviewStreamErrorCode(code)) {
    return code;
  }
  return fallback;
}

function getReviewErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string" &&
    (error as { message: string }).message.length > 0
  ) {
    return (error as { message: string }).message;
  }

  return getErrorMessage(error);
}

function normalizeReviewStreamError(
  error: unknown,
  fallbackCode: ReviewErrorCodeType = ReviewErrorCode.GENERATION_FAILED,
): { code: ReviewErrorCodeType; message: string } {
  if (isReviewAbort(error)) {
    return {
      code: normalizeReviewErrorCode(error.code, fallbackCode),
      message: error.message,
    };
  }

  if (error && typeof error === "object") {
    return {
      code: normalizeReviewErrorCode(
        (error as { code?: unknown }).code,
        fallbackCode,
      ),
      message: getReviewErrorMessage(error),
    };
  }

  return {
    code: fallbackCode,
    message: getReviewErrorMessage(error),
  };
}

function reviewStreamError(
  message: string,
  code: unknown = ReviewErrorCode.GENERATION_FAILED,
): FullReviewStreamEvent {
  return {
    type: "error",
    error: {
      code: normalizeReviewErrorCode(code),
      message,
    },
  };
}

async function writeReviewStreamError(
  stream: SSEWriter,
  message: string,
  code?: unknown,
): Promise<void> {
  await writeStreamEvent(stream, reviewStreamError(message, code));
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function handleReviewAbortError(
  error: ReviewAbort,
  emit: EmitFn,
  reviewId: string
): Promise<void> {
  const tasks: Promise<unknown>[] = [emit(reviewStreamError(error.message, error.code))];
  if (error.step) {
    tasks.unshift(emit(stepError(error.step, error.message)));
  }
  await Promise.allSettled(tasks);
  markComplete(reviewId);
}

async function handleUnexpectedError(
  error: unknown,
  emit: EmitFn,
  reviewId: string
): Promise<void> {
  const normalized = normalizeReviewStreamError(error);
  await emit(reviewStreamError(normalized.message, normalized.code));
  markComplete(reviewId);
}

async function handleReviewFailure(
  error: unknown,
  emit: EmitFn,
  reviewId: string
): Promise<void> {
  if (isAbortError(error)) {
    markComplete(reviewId);
    return;
  }

  if (isReviewAbort(error)) {
    await handleReviewAbortError(error, emit, reviewId);
    return;
  }

  await handleUnexpectedError(error, emit, reviewId);
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

export async function streamActiveSessionToSSE(
  stream: SSEWriter,
  session: ActiveSession,
  clientSignal?: AbortSignal
): Promise<void> {
  if (clientSignal?.aborted) {
    return;
  }

  let replayedTerminalEvent = false;
  for (const event of session.events) {
    try {
      await writeStreamEvent(stream, event);
    } catch (error) {
      if (clientSignal?.aborted || isAbortError(error)) {
        return;
      }
      throw error;
    }
    if (event.type === "complete" || event.type === "error") {
      replayedTerminalEvent = true;
    }
  }
  if (replayedTerminalEvent || session.isComplete) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    let done = false;
    let unsubscribe: (() => void) | null = null;

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const clearPoll = (): void => {
      if (!pollTimer) return;
      clearInterval(pollTimer);
      pollTimer = null;
    };

    const onClientAbort = (): void => {
      finish(resolve);
    };

    const cleanup = (): void => {
      unsubscribe?.();
      unsubscribe = null;
      clearPoll();
      clientSignal?.removeEventListener("abort", onClientAbort);
    };

    const finish = (action: () => void): void => {
      if (done) return;
      done = true;
      cleanup();
      action();
    };

    if (clientSignal?.aborted) {
      finish(resolve);
      return;
    }
    clientSignal?.addEventListener("abort", onClientAbort, { once: true });

    unsubscribe = subscribe(session.reviewId, async (event) => {
      try {
        await writeStreamEvent(stream, event);
        if (event.type === "complete" || event.type === "error") {
          finish(resolve);
        }
      } catch (e) {
        if (clientSignal?.aborted || isAbortError(e)) {
          finish(resolve);
          return;
        }
        finish(() => reject(e));
      }
    });

    if (!unsubscribe) {
      writeStreamEvent(stream, { type: "error", error: { code: ReviewErrorCode.SESSION_STALE, message: "Session was cancelled during replay" } }).then(
        () => finish(resolve),
        () => finish(resolve),
      );
      return;
    }

    const checkSessionState = (): boolean => {
      const latest = getSession(session.reviewId);
      if (!latest) {
        writeStreamEvent(stream, { type: "error", error: { code: ReviewErrorCode.SESSION_STALE, message: "Session was cancelled during replay" } }).then(
          () => finish(resolve),
          () => finish(resolve),
        );
        return true;
      }
      if (!latest.isComplete) {
        return false;
      }
      finish(resolve);
      return true;
    };

    if (checkSessionState()) return;

    pollTimer = setInterval(checkSessionState, 250);
    if ("unref" in pollTimer && typeof pollTimer.unref === "function") {
      pollTimer.unref();
    }
  });
}

async function tryReplayExistingSession(
  stream: SSEWriter,
  projectPath: string,
  headCommit: string,
  statusHash: string,
  mode: ReviewMode,
  clientSignal?: AbortSignal
): Promise<boolean> {
  if (!headCommit) return false;

  const existingSession = getActiveSessionForProject(projectPath, headCommit, statusHash, mode);
  if (!existingSession) return false;

  await streamActiveSessionToSSE(stream, existingSession, clientSignal);
  return true;
}

async function runReviewSession(
  aiClient: AIClient,
  options: StreamReviewParams,
  reviewId: string,
  signal: AbortSignal
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
    const parsed = await resolveGitDiff({ gitService, mode, files, emit, reviewId });

    const config = await resolveReviewConfig({ lensIds, profileId, projectPath, emit });

    const outcome = await executeReview({ aiClient, parsed, config, emit, signal });

    const finalResult = await finalizeReview({
      outcome, gitService, emit, reviewId, projectPath, mode,
      parsed, profileId, activeLenses: config.activeLenses, startTime, signal,
    });

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

export async function streamReviewToSSE(
  aiClient: AIClient,
  options: StreamReviewParams,
  stream: SSEWriter,
  clientSignal?: AbortSignal
): Promise<void> {
  if (clientSignal?.aborted) {
    return;
  }

  const { mode = "unstaged", files, lenses: lensIds, profile: profileId, projectPath: projectPathOption } = options;
  const projectPath = projectPathOption ?? process.cwd();
  const gitService = createGitService({ cwd: projectPath });

  let headCommit: string;
  let statusHash: string;
  try {
    const [headCommitResult, currentStatusHash] = await Promise.all([
      gitService.getHeadCommit(),
      gitService.getStatusHash(),
    ]);

    if (!headCommitResult.ok) {
      await writeReviewStreamError(
        stream,
        `Failed to inspect repository state: ${headCommitResult.error.message}`,
      );
      return;
    }

    headCommit = headCommitResult.value;
    statusHash = currentStatusHash;
  } catch (error) {
    await writeReviewStreamError(
      stream,
      `Failed to inspect repository state: ${getErrorMessage(error)}`,
    );
    return;
  }

  const replayed = await tryReplayExistingSession(
    stream,
    projectPath,
    headCommit,
    statusHash,
    mode,
    clientSignal,
  );
  if (replayed) return;

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

  await streamActiveSessionToSSE(stream, session, clientSignal);
}
