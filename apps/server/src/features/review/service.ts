import { randomUUID } from "node:crypto";
import { createGitService } from "../../shared/lib/git/service.js";
import type { AIClient } from "../../shared/lib/ai/types.js";
import { getErrorMessage } from "@stargazer/core/errors";
import { ReviewErrorCode, type ReviewMode } from "@stargazer/schemas/review";
import { ErrorCode } from "@stargazer/schemas/errors";
import { writeSSEError, type SSEWriter } from "../../shared/lib/http/sse.js";
import type { StepId, FullReviewStreamEvent } from "@stargazer/schemas/events";
import {
  createSession,
  markReady,
  addEvent,
  markComplete,
  subscribe,
  getActiveSessionForProject,
  getSession,
  deleteSession,
  type ActiveSession,
} from "./sessions.js";
import type { EmitFn, StreamReviewParams } from "./types.js";
import {
  resolveGitDiff,
  resolveReviewConfig,
  executeReview,
  finalizeReview,
  ReviewAbort,
} from "./pipeline.js";

function stepError(step: StepId, error: string): { type: "step_error"; step: StepId; error: string; timestamp: string } {
  return { type: "step_error", step, error, timestamp: new Date().toISOString() };
}

async function writeStreamEvent(stream: SSEWriter, event: FullReviewStreamEvent): Promise<void> {
  await stream.writeSSE({
    event: event.type,
    data: JSON.stringify(event),
  });
}

export async function streamActiveSessionToSSE(
  stream: SSEWriter,
  session: ActiveSession
): Promise<void> {
  for (const event of session.events) {
    await writeStreamEvent(stream, event);
  }
  if (session.isComplete) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const unsubscribe = subscribe(session.reviewId, async (event) => {
      try {
        await writeStreamEvent(stream, event);
        if (event.type === "complete" || event.type === "error") {
          unsubscribe?.();
          resolve();
        }
      } catch (e) {
        unsubscribe?.();
        reject(e);
      }
    });

    if (!unsubscribe) {
      writeStreamEvent(stream, { type: "error", error: { code: ReviewErrorCode.SESSION_STALE, message: "Session was cancelled during replay" } }).then(resolve, resolve);
      return;
    }

    const latest = getSession(session.reviewId);
    if (!latest || latest.isComplete) {
      unsubscribe();
      writeStreamEvent(stream, { type: "error", error: { code: ReviewErrorCode.SESSION_STALE, message: "Session was cancelled during replay" } }).then(resolve, resolve);
    }
  });
}

async function tryReplayExistingSession(
  stream: SSEWriter,
  projectPath: string,
  headCommit: string,
  statusHash: string,
  mode: ReviewMode
): Promise<boolean> {
  if (!headCommit) return false;

  const existingSession = getActiveSessionForProject(projectPath, headCommit, statusHash, mode);
  if (!existingSession) return false;

  await streamActiveSessionToSSE(stream, existingSession);
  return true;
}

export async function streamReviewToSSE(
  aiClient: AIClient,
  options: StreamReviewParams,
  stream: SSEWriter,
  clientSignal?: AbortSignal
): Promise<void> {
  const { mode = "unstaged", files, lenses: lensIds, profile: profileId, projectPath: projectPathOption } = options;
  const startTime = Date.now();
  const projectPath = projectPathOption ?? process.cwd();
  const gitService = createGitService({ cwd: projectPath });

  let headCommit: string;
  let statusHash: string;
  try {
    [headCommit, statusHash] = await Promise.all([
      gitService.getHeadCommit(),
      gitService.getStatusHash(),
    ]);
  } catch {
    headCommit = "";
    statusHash = "";
  }

  const replayed = await tryReplayExistingSession(stream, projectPath, headCommit, statusHash, mode);
  if (replayed) return;

  const reviewId = randomUUID();
  const session = createSession(reviewId, projectPath, headCommit, statusHash, mode);
  markReady(reviewId);

  const signal = clientSignal
    ? AbortSignal.any([session.controller.signal, clientSignal])
    : session.controller.signal;

  const emit: EmitFn = async (event) => {
    if (signal.aborted) return;
    addEvent(reviewId, event);
    await writeStreamEvent(stream, event);
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
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }

    if (error instanceof ReviewAbort) {
      try {
        if (error.step) {
          await emit(stepError(error.step, error.message));
        }
        await writeSSEError(stream, error.message, error.code);
        markComplete(reviewId);
      } catch {
      }
      return;
    }

    markComplete(reviewId);
    deleteSession(reviewId);
    try {
      await writeSSEError(stream, getErrorMessage(error), ErrorCode.INTERNAL_ERROR);
    } catch {
      throw error;
    }
  }
}
