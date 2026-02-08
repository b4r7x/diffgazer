import type { FullReviewStreamEvent } from "@stargazer/schemas/events";
import { ReviewErrorCode, type ReviewMode } from "@stargazer/schemas/review";

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
  controller: AbortController;
}

const MAX_SESSIONS = 50;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const activeSessions = new Map<string, ActiveSession>();

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
    session.events.push(event);
    session.subscribers.forEach(cb => {
      try {
        Promise.resolve(cb(event)).catch(e => {
          console.error('Subscriber callback error:', e);
        });
      } catch (e) {
        console.error('Subscriber callback error:', e);
      }
    });
  }
}

export function markComplete(reviewId: string): void {
  const session = activeSessions.get(reviewId);
  if (session && !session.isComplete) {
    session.isComplete = true;
    session.subscribers.clear();
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
  session.events.push(cancelEvent);
  session.isComplete = true;

  session.subscribers.forEach((cb) => {
    try {
      Promise.resolve(cb(cancelEvent)).catch(e => {
        console.error("Subscriber callback error:", e);
      });
    } catch (e) {
      console.error("Subscriber callback error:", e);
    }
  });
  session.subscribers.clear();
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
