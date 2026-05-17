import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import type { SSEWriter } from "../../shared/lib/http/sse.js";
import {
  type ActiveSession,
  getSession,
  onSessionComplete,
  subscribe,
} from "./sessions.js";
import { isAbortError, isTerminalEvent } from "./stream-events.js";

async function writeStreamEvent(
  stream: SSEWriter,
  event: FullReviewStreamEvent,
): Promise<void> {
  await stream.writeSSE({
    event: event.type,
    data: JSON.stringify(event),
  });
}

const STALE_ERROR_EVENT: FullReviewStreamEvent = {
  type: "error",
  error: {
    code: ReviewErrorCode.SESSION_STALE,
    message: "Session was cancelled during replay",
  },
};

export async function streamActiveSessionToSSE(
  stream: SSEWriter,
  session: ActiveSession,
  clientSignal?: AbortSignal,
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
    if (isTerminalEvent(event)) {
      replayedTerminalEvent = true;
    }
  }
  if (replayedTerminalEvent || session.isComplete) {
    return;
  }

  const replayCursor = session.events.length;

  await new Promise<void>((resolve, reject) => {
    let done = false;
    let terminalClaimed = false;
    let pendingWrite: Promise<void> = Promise.resolve();
    let unsubscribe: (() => void) | null = null;
    let unsubscribeCompletion: (() => void) | null = null;

    const finish = (action: () => void): void => {
      if (done) return;
      done = true;
      unsubscribe?.();
      unsubscribe = null;
      unsubscribeCompletion?.();
      unsubscribeCompletion = null;
      clientSignal?.removeEventListener("abort", onClientAbort);
      pendingWrite.then(action, action);
    };

    const onClientAbort = (): void => finish(resolve);

    const writeTerminal = (event: FullReviewStreamEvent): void => {
      terminalClaimed = true;
      pendingWrite = writeStreamEvent(stream, event);
      pendingWrite.then(
        () => finish(resolve),
        (e) => {
          if (clientSignal?.aborted || isAbortError(e)) {
            finish(resolve);
            return;
          }
          console.warn("SSE terminal write failed:", e);
          finish(() => reject(e));
        },
      );
    };

    if (clientSignal?.aborted) {
      finish(resolve);
      return;
    }
    clientSignal?.addEventListener("abort", onClientAbort, { once: true });

    unsubscribe = subscribe(session.reviewId, (event) => {
      if (isTerminalEvent(event)) terminalClaimed = true;
      pendingWrite = pendingWrite.then(() => writeStreamEvent(stream, event));
      pendingWrite.then(
        () => {
          if (terminalClaimed) finish(resolve);
        },
        (e) => {
          if (clientSignal?.aborted || isAbortError(e)) {
            finish(resolve);
            return;
          }
          console.warn("SSE subscriber write failed:", e);
          finish(() => reject(e));
        },
      );
    });

    if (!unsubscribe) {
      writeTerminal(STALE_ERROR_EVENT);
      return;
    }

    const onComplete = (): void => {
      if (done) return;
      const latest = getSession(session.reviewId);
      if (!latest) {
        writeTerminal(STALE_ERROR_EVENT);
        return;
      }
      if (terminalClaimed) {
        finish(resolve);
        return;
      }
      const terminalEvent = [...latest.events].slice(replayCursor).reverse().find(isTerminalEvent)
        ?? [...latest.events].reverse().find(isTerminalEvent);
      if (terminalEvent) {
        writeTerminal(terminalEvent);
        return;
      }
      finish(resolve);
    };

    unsubscribeCompletion = onSessionComplete(session.reviewId, onComplete);
    if (!unsubscribeCompletion) {
      writeTerminal(STALE_ERROR_EVENT);
      return;
    }
  });
}
