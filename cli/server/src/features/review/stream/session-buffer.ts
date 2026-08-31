/**
 * One session's record and its bounded event buffer: the shape a live review
 * carries, the append that keeps the replay buffer inside its cap, and the
 * fan-out to that session's own subscribers. Everything here is pure over an
 * `ActiveSession` value — the registry that holds the sessions, evicts them and
 * decides when one is cancelled lives in `store.ts`.
 */
import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { log } from "../../../shared/lib/log.js";
import { isTerminalEvent } from "./events.js";

/**
 * Discriminant for a session's stored `statusHash` provenance. A content-blind
 * `status-only` hash (the worktree diff exceeded the read limit) must never be
 * compared against a `full` hash, and an `unavailable` session was created
 * without a verifiable hash, so dedupe/stale-cancel comparisons skip it.
 */
export type StatusHashKind = "full" | "status-only" | "unavailable";
type ReviewPersistenceState = "pending" | "committing" | "committed";

export interface ActiveSession {
  reviewId: string;
  projectPath: string;
  headCommit: string;
  statusHash: string;
  statusHashKind: StatusHashKind;
  mode: ReviewMode;
  scopeKey: string;
  reviewConfigKey: string;
  reviewInputHash: string;
  provider: string | null;
  configurationId: string | null;
  configurationRevision: number | null;
  admittedExecutionFingerprint: string | null;
  leaseId: string | null;
  startedAt: Date;
  lastActivityTick: number;
  events: FullReviewStreamEvent[];
  isComplete: boolean;
  isReady: boolean;
  persistenceState: ReviewPersistenceState;
  capWarningEmitted: boolean;
  driftNoticeEmitted: boolean;
  /**
   * Writes whatever the run has streamed so far to history. Every termination
   * funnels through `terminateSession`, which fires this before the abort
   * so an interrupted review keeps its partial findings.
   */
  persistPartial: (() => Promise<void>) | null;
  subscribers: Set<(event: FullReviewStreamEvent) => void>;
  completionListeners: Set<() => void>;
  controller: AbortController;
}

const MAX_EVENTS_PER_SESSION = 10_000;

// Non-terminal cap notice. A `chunk` because that is the only union member with a
// free-text payload and no effect on UI step/agent state; the client surfaces it as a
// user-visible notice so the truncation is observable.
const CAP_WARNING_CONTENT = `[diffgazer] Event cap (${MAX_EVENTS_PER_SESSION}) reached; subsequent progress events may be incomplete.`;

export function capWarningEvent(): FullReviewStreamEvent {
  return { type: "chunk", content: CAP_WARNING_CONTENT };
}

function isCapWarningEvent(event: FullReviewStreamEvent | undefined): boolean {
  return event?.type === "chunk" && event.content === CAP_WARNING_CONTENT;
}

export type StoreEventResult = { stored: boolean; firstDrop: boolean };

// Append to the session buffer, bounded at MAX_EVENTS_PER_SESSION. The cap governs
// the buffer only, never live delivery. Terminal events past the cap overwrite an
// older slot so the outcome stays observable; non-terminal ones are dropped from the
// buffer, and the first drop is reported via `firstDrop`.
export function storeSessionEvent(
  session: ActiveSession,
  event: FullReviewStreamEvent,
  activityTick: number,
): StoreEventResult {
  session.lastActivityTick = activityTick;
  if (session.events.length < MAX_EVENTS_PER_SESSION) {
    session.events.push(event);
    return { stored: true, firstDrop: false };
  }

  const firstDrop = !session.capWarningEmitted;
  if (firstDrop) {
    session.capWarningEmitted = true;
    log("warn", "session_event_cap_reached", {
      cap: MAX_EVENTS_PER_SESSION,
      reviewId: session.reviewId,
    });
  }

  if (!isTerminalEvent(event)) {
    return { stored: false, firstDrop };
  }

  // The terminal event takes the final slot; if that slot held the cap warning, move the
  // warning back one slot instead of dropping it, so late SSE replays still see the
  // truncation notice.
  const lastIndex = session.events.length - 1;
  if (isCapWarningEvent(session.events[lastIndex])) {
    const overwriteIndex = Math.max(lastIndex - 1, 0);
    session.events[overwriteIndex] = capWarningEvent();
    session.events[lastIndex] = event;
  } else {
    session.events[lastIndex] = event;
  }
  return { stored: true, firstDrop };
}

export function notifySubscribers(session: ActiveSession, event: FullReviewStreamEvent): void {
  const handleError = (e: unknown) => log("error", "subscriber_callback_error", { error: e });
  session.subscribers.forEach((cb) => {
    try {
      Promise.resolve(cb(event)).catch(handleError);
    } catch (e) {
      handleError(e);
    }
  });
}

export function notifyCompletion(session: ActiveSession): void {
  session.completionListeners.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      log("error", "completion_listener_error", { error: e });
    }
  });
  session.completionListeners.clear();
}
