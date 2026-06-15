import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { log } from "../../../shared/lib/log.js";
import { isAbortError, isTerminalEvent } from "./events.js";
import type { SSEWriter } from "./sse.js";
import { type ActiveSession, getSession, onSessionComplete, subscribe } from "./store.js";

async function writeStreamEvent(stream: SSEWriter, event: FullReviewStreamEvent): Promise<void> {
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

  // Subscribe BEFORE reading the snapshot to close the race window where
  // events arrive between snapshot read and subscribe. Buffer live events
  // during replay; drain afterward, deduplicating by reference identity.
  const liveQueue: FullReviewStreamEvent[] = [];
  let draining = false;

  const earlyUnsub = subscribe(session.reviewId, (event) => {
    if (!draining) {
      liveQueue.push(event);
    }
  });

  if (!earlyUnsub) {
    // Session already gone
    try {
      await writeStreamEvent(stream, STALE_ERROR_EVENT);
    } catch (e) {
      if (clientSignal?.aborted || isAbortError(e)) {
        return;
      }
      log("warn", "sse_terminal_write_failed", { error: e });
      throw e;
    }
    return;
  }

  // Snapshot the events array length AND capture references now, before
  // the live array can be mutated by cap-replacement or new pushes.
  const snapshotLength = session.events.length;
  const replayedSet = new Set(session.events.slice(0, snapshotLength));

  let replayedTerminalEvent = false;
  for (const event of replayedSet) {
    try {
      await writeStreamEvent(stream, event);
    } catch (error) {
      earlyUnsub();
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
    earlyUnsub();
    // Drain any remaining buffered live events that arrived during replay
    for (const event of liveQueue) {
      if (replayedSet.has(event)) continue;
      try {
        await writeStreamEvent(stream, event);
      } catch (error) {
        if (clientSignal?.aborted || isAbortError(error)) return;
        throw error;
      }
    }
    return;
  }

  // Transition to live streaming. Remove the early subscriber and wire up
  // the full promise-based subscriber + completion listener.
  earlyUnsub();

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
          log("warn", "sse_terminal_write_failed", { error: e });
          finish(() => reject(e));
        },
      );
    };

    if (clientSignal?.aborted) {
      finish(resolve);
      return;
    }
    clientSignal?.addEventListener("abort", onClientAbort, { once: true });

    // Drain buffered live events first, then subscribe for new ones.
    draining = true;
    const processEvent = (event: FullReviewStreamEvent): void => {
      if (replayedSet.has(event)) return;
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
          log("warn", "sse_subscriber_write_failed", { error: e });
          finish(() => reject(e));
        },
      );
    };

    for (const event of liveQueue) {
      processEvent(event);
    }

    unsubscribe = subscribe(session.reviewId, processEvent);

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
      const terminalEvent =
        [...latest.events].slice(snapshotLength).reverse().find(isTerminalEvent) ??
        [...latest.events].reverse().find(isTerminalEvent);
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
