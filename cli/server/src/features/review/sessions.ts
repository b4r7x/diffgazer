import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import { ReviewErrorCode, type ReviewMode } from "@diffgazer/core/schemas/review";

export interface ActiveSession {
  reviewId: string;
  projectPath: string;
  headCommit: string;
  statusHash: string;
  mode: ReviewMode;
  startedAt: Date;
  events: FullReviewStreamEvent[];
  isComplete: boolean;
  isReady: boolean;
  subscribers: Set<(event: FullReviewStreamEvent) => void>;
  completionListeners: Set<() => void>;
  controller: AbortController;
}

const MAX_SESSIONS = 50;
const MAX_EVENTS_PER_SESSION = 10_000;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const activeSessions = new Map<string, ActiveSession>();

function isTerminalEvent(event: FullReviewStreamEvent): boolean {
  return event.type === "complete" || event.type === "error";
}

function storeSessionEvent(session: ActiveSession, event: FullReviewStreamEvent): boolean {
  if (session.events.length < MAX_EVENTS_PER_SESSION) {
    session.events.push(event);
    return true;
  }
  if (!isTerminalEvent(event)) {
    return false;
  }

  session.events[session.events.length - 1] = event;
  return true;
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
      session.isComplete = true;
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
      session.isComplete = true;
      session.subscribers.clear();
      notifyCompletion(session);
      activeSessions.delete(id);
    }
  }
}

const cleanupInterval = setInterval(cleanupStaleSessions, 5 * 60 * 1000);
cleanupInterval.unref();

export function createSession(
  reviewId: string,
  projectPath: string,
  headCommit: string,
  statusHash: string,
  mode: ReviewMode
): ActiveSession {
  if (activeSessions.size >= MAX_SESSIONS) {
    evictOldestSession();
  }

  const session: ActiveSession = {
    reviewId,
    projectPath,
    headCommit,
    statusHash,
    mode,
    startedAt: new Date(),
    events: [],
    isComplete: false,
    isReady: false,
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
  if (session && !session.isComplete) {
    if (!storeSessionEvent(session, event)) return;
    notifySubscribers(session, event);
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
  headCommit: string,
  statusHash: string,
  mode: ReviewMode
): ActiveSession | undefined {
  for (const session of activeSessions.values()) {
    if (
      session.projectPath === projectPath &&
      session.headCommit === headCommit &&
      session.statusHash === statusHash &&
      session.mode === mode &&
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
