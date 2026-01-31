import type { FullTriageStreamEvent } from '@repo/schemas';

interface ActiveSession {
  reviewId: string;
  projectPath: string;
  startedAt: Date;
  events: FullTriageStreamEvent[];
  isComplete: boolean;
  isReady: boolean; // Session has initial events and is safe to replay
  subscribers: Set<(event: FullTriageStreamEvent) => void>;
}

const activeSessions = new Map<string, ActiveSession>();

export function createSession(reviewId: string, projectPath: string): ActiveSession {
  const session: ActiveSession = {
    reviewId,
    projectPath,
    startedAt: new Date(),
    events: [],
    isComplete: false,
    isReady: false,
    subscribers: new Set(),
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

export function getSession(reviewId: string): ActiveSession | undefined {
  return activeSessions.get(reviewId);
}

export function addEvent(reviewId: string, event: FullTriageStreamEvent): void {
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

export function subscribe(reviewId: string, callback: (event: FullTriageStreamEvent) => void): () => void {
  const session = activeSessions.get(reviewId);
  if (session) {
    session.subscribers.add(callback);
    return () => session.subscribers.delete(callback);
  }
  return () => {};
}

export function getActiveSessionForProject(projectPath: string): ActiveSession | undefined {
  for (const session of activeSessions.values()) {
    if (session.projectPath === projectPath && !session.isComplete && session.isReady) {
      return session;
    }
  }
  return undefined;
}

export type { ActiveSession };
