import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import { ReviewErrorCode, type ReviewMode } from "@diffgazer/core/schemas/review";

export interface ActiveSession {
  reviewId: string;
  projectPath: string;
  headCommit: string;
  statusHash: string;
  mode: ReviewMode;
  scopeKey: string;
  startedAt: Date;
  events: FullReviewStreamEvent[];
  isComplete: boolean;
  isReady: boolean;
  capWarningEmitted: boolean;
  subscribers: Set<(event: FullReviewStreamEvent) => void>;
  completionListeners: Set<() => void>;
  controller: AbortController;
}

export function buildScopeKey(params: {
  files?: string[];
  lenses?: string[];
  profile?: string;
}): string {
  const parts: string[] = [];
  if (params.files && params.files.length > 0) {
    parts.push(`f:${[...params.files].sort().join(",")}`);
  }
  if (params.lenses && params.lenses.length > 0) {
    parts.push(`l:${[...params.lenses].sort().join(",")}`);
  }
  if (params.profile) {
    parts.push(`p:${params.profile}`);
  }
  return parts.join("|");
}

const MAX_SESSIONS = 50;
const MAX_EVENTS_PER_SESSION = 10_000;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const activeSessions = new Map<string, ActiveSession>();

function isTerminalEvent(event: FullReviewStreamEvent): boolean {
  return event.type === "complete" || event.type === "error";
}

/**
 * Builds the non-terminal notice replayed/streamed to the client when the
 * per-session event cap is hit and progress events start being dropped. It is a
 * `chunk` event because that is the only union member with a free-text payload
 * and a no-op effect on UI step/agent state (it maps to the optional `onChunk`
 * client callback). This signals partial progress to the client instead of
 * dropping events silently. (F155)
 */
function capWarningEvent(): FullReviewStreamEvent {
  return {
    type: "chunk",
    content: `[diffgazer] Event cap (${MAX_EVENTS_PER_SESSION}) reached; subsequent progress events may be incomplete.`,
  };
}

type StoreEventResult =
  | { stored: true }
  | { stored: false; firstDrop: boolean };

/**
 * Appends an event to the session buffer, bounding growth at
 * `MAX_EVENTS_PER_SESSION`. Terminal events overwrite the last slot so the
 * outcome is always observable. Non-terminal events past the cap are dropped;
 * the first such drop is reported via `firstDrop` so the caller can emit a
 * single client-facing cap notice.
 */
function storeSessionEvent(session: ActiveSession, event: FullReviewStreamEvent): StoreEventResult {
  if (session.events.length < MAX_EVENTS_PER_SESSION) {
    session.events.push(event);
    return { stored: true };
  }

  const firstDrop = !session.capWarningEmitted;
  if (firstDrop) {
    session.capWarningEmitted = true;
    console.warn(`[sessions] Event cap (${MAX_EVENTS_PER_SESSION}) reached for session ${session.reviewId}`);
  }

  if (!isTerminalEvent(event)) {
    return { stored: false, firstDrop };
  }

  session.events[session.events.length - 1] = event;
  return { stored: true };
}

function notifySubscribers(session: ActiveSession, event: FullReviewStreamEvent): void {
  const handleError = (e: unknown) => console.error('Subscriber callback error:', e);
  session.subscribers.forEach(cb => {
    try {
      Promise.resolve(cb(event)).catch(handleError);
    } catch (e) {
      handleError(e);
    }
  });
}

function notifyCompletion(session: ActiveSession): void {
  session.completionListeners.forEach(cb => {
    try {
      cb();
    } catch (e) {
      console.error('Completion listener error:', e);
    }
  });
  session.completionListeners.clear();
}

function evictOldestSession(): void {
  let oldest: { id: string; startedAt: Date } | null = null;
  for (const [id, session] of activeSessions) {
    if (!oldest || session.startedAt < oldest.startedAt) {
      oldest = { id, startedAt: session.startedAt };
    }
  }
  if (oldest) {
    const session = activeSessions.get(oldest.id);
    if (session && !session.isComplete) {
      session.controller.abort("evicted");
      const evictionEvent: FullReviewStreamEvent = {
        type: "error",
        error: {
          code: ReviewErrorCode.SESSION_STALE,
          message: "Review session evicted due to session limit.",
        },
      };
      storeSessionEvent(session, evictionEvent);
      session.isComplete = true;
      notifySubscribers(session, evictionEvent);
      session.subscribers.clear();
      notifyCompletion(session);
    }
    activeSessions.delete(oldest.id);
  }
}

function cleanupStaleSessions(): void {
  const now = Date.now();
  for (const [id, session] of activeSessions) {
    if (!session.isComplete && now - session.startedAt.getTime() > SESSION_TIMEOUT_MS) {
      session.controller.abort("timeout");
      const timeoutEvent: FullReviewStreamEvent = {
        type: "error",
        error: {
          code: ReviewErrorCode.SESSION_STALE,
          message: "Review session timed out.",
        },
      };
      storeSessionEvent(session, timeoutEvent);
      session.isComplete = true;
      notifySubscribers(session, timeoutEvent);
      session.subscribers.clear();
      notifyCompletion(session);
      activeSessions.delete(id);
    }
  }
}

let cleanupInterval: ReturnType<typeof setInterval> | null = setInterval(
  cleanupStaleSessions,
  5 * 60 * 1000,
);
cleanupInterval.unref();

/**
 * Clears the stale-session cleanup interval. Call on server shutdown/SIGTERM and
 * in test teardown so the timer does not outlive the process or leak across tests.
 */
export function shutdownSessions(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

export function createSession(
  reviewId: string,
  options: {
    projectPath: string;
    headCommit: string;
    statusHash: string;
    mode: ReviewMode;
    scopeKey?: string;
  },
): ActiveSession {
  if (activeSessions.size >= MAX_SESSIONS) {
    evictOldestSession();
  }

  const session: ActiveSession = {
    reviewId,
    projectPath: options.projectPath,
    headCommit: options.headCommit,
    statusHash: options.statusHash,
    mode: options.mode,
    scopeKey: options.scopeKey ?? "",
    startedAt: new Date(),
    events: [],
    isComplete: false,
    isReady: false,
    capWarningEmitted: false,
    subscribers: new Set(),
    completionListeners: new Set(),
    controller: new AbortController(),
  };
  activeSessions.set(reviewId, session);
  return session;
}

export function markReady(reviewId: string): void {
  const session = activeSessions.get(reviewId);
  if (session) {
    session.isReady = true;
  }
}

export function addEvent(reviewId: string, event: FullReviewStreamEvent): void {
  const session = activeSessions.get(reviewId);
  if (!session || session.isComplete) return;

  const result = storeSessionEvent(session, event);
  if (result.stored) {
    notifySubscribers(session, event);
    return;
  }

  // Event was dropped at the cap. On the first drop, surface a single
  // non-terminal notice so the client knows the stream is incomplete instead
  // of the events vanishing silently. The notice is stored (one-time overflow
  // past the cap) so late SSE replays still see it, then streamed live. (F155)
  if (result.firstDrop) {
    const notice = capWarningEvent();
    session.events.push(notice);
    notifySubscribers(session, notice);
  }
}

export function markComplete(reviewId: string): void {
  const session = activeSessions.get(reviewId);
  if (session && !session.isComplete) {
    session.isComplete = true;
    session.subscribers.clear();
    notifyCompletion(session);
    setTimeout(() => activeSessions.delete(reviewId), 5 * 60 * 1000);
  }
}

export function cancelSession(reviewId: string): void {
  const session = activeSessions.get(reviewId);
  if (!session || session.isComplete) return;

  session.controller.abort("session_stale");
  const cancelEvent: FullReviewStreamEvent = {
    type: "error",
    error: {
      code: ReviewErrorCode.SESSION_STALE,
      message: "Review session cancelled because repository state changed.",
    },
  };
  storeSessionEvent(session, cancelEvent);
  session.isComplete = true;

  notifySubscribers(session, cancelEvent);
  session.subscribers.clear();
  notifyCompletion(session);
  setTimeout(() => activeSessions.delete(reviewId), 2 * 60 * 1000);
}

export function cancelStaleSessionsForProjectMode(
  projectPath: string,
  mode: ReviewMode,
  headCommit: string,
  statusHash: string
): void {
  if (!headCommit || !statusHash) {
    return;
  }

  for (const [reviewId, session] of activeSessions) {
    if (session.isComplete) continue;
    if (session.projectPath !== projectPath) continue;
    if (session.mode !== mode) continue;
    if (session.headCommit === headCommit && session.statusHash === statusHash) {
      continue;
    }
    cancelSession(reviewId);
  }
}

export function subscribe(
  reviewId: string,
  callback: (event: FullReviewStreamEvent) => void
): (() => void) | null {
  const session = activeSessions.get(reviewId);
  if (session) {
    session.subscribers.add(callback);
    return () => session.subscribers.delete(callback);
  }
  return null;
}

export function onSessionComplete(
  reviewId: string,
  callback: () => void
): (() => void) | null {
  const session = activeSessions.get(reviewId);
  if (!session) return null;
  if (session.isComplete) {
    callback();
    return () => {};
  }
  session.completionListeners.add(callback);
  return () => session.completionListeners.delete(callback);
}

export function getActiveSessionForProject(
  projectPath: string,
  options: {
    headCommit: string;
    statusHash: string;
    mode: ReviewMode;
    scopeKey?: string;
  },
): ActiveSession | undefined {
  const scopeKey = options.scopeKey ?? "";
  for (const session of activeSessions.values()) {
    if (
      session.projectPath === projectPath &&
      session.headCommit === options.headCommit &&
      session.statusHash === options.statusHash &&
      session.mode === options.mode &&
      session.scopeKey === scopeKey &&
      !session.isComplete &&
      session.isReady
    ) {
      return session;
    }
  }
  return undefined;
}

export function getSession(reviewId: string): ActiveSession | undefined {
  return activeSessions.get(reviewId);
}

export function deleteSession(reviewId: string): void {
  activeSessions.delete(reviewId);
}
