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

const activeSessions = new Map<string, ActiveSession>();

export function createSession(
  reviewId: string,
  projectPath: string,
  headCommit: string,
  statusHash: string,
  mode: ReviewMode
): ActiveSession {
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
        cb(event);
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
  if (!session) return;

  session.controller.abort("session_stale");
  session.isComplete = true;
  const cancelEvent: FullReviewStreamEvent = {
    type: "error",
    error: {
      code: ReviewErrorCode.SESSION_STALE,
      message: "Review session cancelled because repository state changed.",
    },
  };

  session.subscribers.forEach((cb) => {
    try {
      cb(cancelEvent);
    } catch (e) {
      console.error("Subscriber callback error:", e);
    }
  });
  session.subscribers.clear();
  setTimeout(() => activeSessions.delete(reviewId), 2 * 60 * 1000);
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
