import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import { ReviewErrorCode, type ReviewMode } from "@diffgazer/core/schemas/review";
import { log } from "../../../shared/lib/log.js";
import {
  registerSession,
  type SessionCancelOptions,
  unregisterSession,
} from "../../../shared/lib/session-registry.js";
import { isTerminalEvent } from "./events.js";

/**
 * Discriminant for a session's stored `statusHash` provenance. A content-blind
 * `status-only` hash (the worktree diff exceeded the read limit) must never be
 * compared against a `full` hash, and an `unavailable` session was created
 * without a verifiable hash, so dedupe/stale-cancel comparisons skip it.
 */
export type StatusHashKind = "full" | "status-only" | "unavailable";

export interface ActiveSession {
  reviewId: string;
  projectPath: string;
  headCommit: string;
  statusHash: string;
  statusHashKind: StatusHashKind;
  mode: ReviewMode;
  scopeKey: string;
  reviewConfigKey: string;
  provider: string | null;
  startedAt: Date;
  lastEventAt: Date;
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
    // JSON-encode the file list so filenames containing the "," or "|" delimiters
    // cannot make two different selections collapse onto the same scope key.
    parts.push(`f:${JSON.stringify([...params.files].sort())}`);
  }
  if (params.lenses && params.lenses.length > 0) {
    parts.push(`l:${[...params.lenses].sort().join(",")}`);
  }
  if (params.profile) {
    parts.push(`p:${params.profile}`);
  }
  return parts.join("|");
}

export function buildReviewConfigKey(params: {
  lenses?: string[];
  profile?: string;
  minSeverity?: string;
}): string {
  const parts: string[] = [];
  if (params.lenses && params.lenses.length > 0) {
    parts.push(`l:${[...params.lenses].sort().join(",")}`);
  }
  if (params.profile) {
    parts.push(`p:${params.profile}`);
  }
  if (params.minSeverity) {
    parts.push(`s:${params.minSeverity}`);
  }
  return parts.join("|");
}

// A `status-only` session cannot prove its diff content is unchanged (the repo hash
// stays constant across edits that keep the same porcelain status line), so it must
// never be deduped onto or cancelled by identity — treated like `unavailable` for matching.
function isContentBlindStatusOnly(statusHashKind: StatusHashKind): boolean {
  return statusHashKind === "status-only";
}

const MAX_SESSIONS = 50;
const MAX_EVENTS_PER_SESSION = 10_000;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const activeSessions = new Map<string, ActiveSession>();

// Non-terminal cap notice. A `chunk` because that is the only union member with a
// free-text payload and no effect on UI step/agent state; the client surfaces it as a
// user-visible notice so the truncation is observable.
const CAP_WARNING_CONTENT = `[diffgazer] Event cap (${MAX_EVENTS_PER_SESSION}) reached; subsequent progress events may be incomplete.`;

function capWarningEvent(): FullReviewStreamEvent {
  return { type: "chunk", content: CAP_WARNING_CONTENT };
}

function isCapWarningEvent(event: FullReviewStreamEvent | undefined): boolean {
  return event?.type === "chunk" && event.content === CAP_WARNING_CONTENT;
}

type StoreEventResult = { stored: true } | { stored: false; firstDrop: boolean };

// Append to the session buffer, bounded at MAX_EVENTS_PER_SESSION. Terminal events
// past the cap overwrite an older slot so the outcome stays observable; non-terminal
// ones are dropped, and the first drop is reported via `firstDrop`.
function storeSessionEvent(session: ActiveSession, event: FullReviewStreamEvent): StoreEventResult {
  session.lastEventAt = new Date();
  if (session.events.length < MAX_EVENTS_PER_SESSION) {
    session.events.push(event);
    return { stored: true };
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

  // Overwrite an older slot, not the final one: once the cap is hit the final slot may
  // hold the cap warning, and overwriting it would hide the truncation notice from late
  // SSE replays.
  const lastIndex = session.events.length - 1;
  const overwriteIndex = isCapWarningEvent(session.events[lastIndex])
    ? Math.max(lastIndex - 1, 0)
    : lastIndex;
  session.events[overwriteIndex] = event;
  return { stored: true };
}

function notifySubscribers(session: ActiveSession, event: FullReviewStreamEvent): void {
  const handleError = (e: unknown) => log("error", "subscriber_callback_error", { error: e });
  session.subscribers.forEach((cb) => {
    try {
      Promise.resolve(cb(event)).catch(handleError);
    } catch (e) {
      handleError(e);
    }
  });
}

function notifyCompletion(session: ActiveSession): void {
  session.completionListeners.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      log("error", "completion_listener_error", { error: e });
    }
  });
  session.completionListeners.clear();
}

function terminateSession(
  session: ActiveSession,
  options: { code: ReviewErrorCode; message: string; reason: string },
): void {
  session.controller.abort(options.reason);
  const event: FullReviewStreamEvent = {
    type: "error",
    error: {
      code: options.code,
      message: options.message,
    },
  };
  storeSessionEvent(session, event);
  session.isComplete = true;
  notifySubscribers(session, event);
  session.subscribers.clear();
  notifyCompletion(session);
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
      terminateSession(session, {
        code: ReviewErrorCode.SESSION_EVICTED,
        message: "Review session evicted due to session limit.",
        reason: "evicted",
      });
    }
    activeSessions.delete(oldest.id);
    unregisterSession(oldest.id);
  }
}

// Terminate sessions idle past SESSION_TIMEOUT_MS with a SESSION_TIMEOUT error. Runs on
// the 5-minute cleanup interval; exported so the timeout path is drivable in tests (the
// module-eval interval is not intercepted by vitest fake timers).
export function cleanupStaleSessions(): void {
  const now = Date.now();
  for (const [id, session] of activeSessions) {
    if (!session.isComplete && now - session.lastEventAt.getTime() > SESSION_TIMEOUT_MS) {
      terminateSession(session, {
        code: ReviewErrorCode.SESSION_TIMEOUT,
        message: "Review session timed out.",
        reason: "timeout",
      });
      activeSessions.delete(id);
      unregisterSession(id);
    }
  }
}

let cleanupInterval: ReturnType<typeof setInterval> | null = setInterval(
  cleanupStaleSessions,
  5 * 60 * 1000,
);
cleanupInterval.unref();

// Tear down all in-memory session state for shutdown/SIGTERM and test teardown: clear
// the cleanup interval, abort in-flight work, emit a terminal error to subscribers, and
// clear subscribers/listeners so no SSE client keeps the process alive.
export function shutdownSessions(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }

  for (const [id, session] of activeSessions) {
    if (!session.isComplete) {
      terminateSession(session, {
        code: ReviewErrorCode.SERVER_SHUTDOWN,
        message: "Review session aborted because the server is shutting down.",
        reason: "shutdown",
      });
    }
    session.subscribers.clear();
    session.completionListeners.clear();
    activeSessions.delete(id);
    unregisterSession(id);
  }
}

export function createSession(
  reviewId: string,
  options: {
    projectPath: string;
    headCommit: string;
    statusHash: string;
    statusHashKind: StatusHashKind;
    mode: ReviewMode;
    scopeKey?: string;
    reviewConfigKey?: string;
    provider?: string | null;
  },
): ActiveSession {
  if (activeSessions.size >= MAX_SESSIONS) {
    evictOldestSession();
  }

  const startedAt = new Date();
  const session: ActiveSession = {
    reviewId,
    projectPath: options.projectPath,
    headCommit: options.headCommit,
    statusHash: options.statusHash,
    statusHashKind: options.statusHashKind,
    mode: options.mode,
    scopeKey: options.scopeKey ?? "",
    reviewConfigKey: options.reviewConfigKey ?? "",
    provider: options.provider ?? null,
    startedAt,
    lastEventAt: startedAt,
    events: [],
    isComplete: false,
    isReady: false,
    capWarningEmitted: false,
    subscribers: new Set(),
    completionListeners: new Set(),
    controller: new AbortController(),
  };
  activeSessions.set(reviewId, session);
  registerSession(reviewId, {
    projectKey: session.projectPath,
    cancel: (options?: SessionCancelOptions) => {
      if (session.isComplete) return;
      if (options?.provider && session.provider !== options.provider) return;
      cancelSession(reviewId, { message: options?.message, reason: options?.reason });
    },
  });
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

  // First drop at the cap: store one notice (one-time overflow past the cap) so late
  // SSE replays see it, then stream it live.
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
    setTimeout(
      () => {
        activeSessions.delete(reviewId);
        unregisterSession(reviewId);
      },
      5 * 60 * 1000,
    ).unref();
  }
}

export function cancelSession(
  reviewId: string,
  options?: { message?: string; reason?: string },
): void {
  cancelSessionWithError(reviewId, {
    code: ReviewErrorCode.SESSION_STALE,
    message: options?.message ?? "Review session cancelled because repository state changed.",
    reason: options?.reason ?? "session_stale",
  });
}

export function cancelSessionForUser(reviewId: string): void {
  cancelSessionWithError(reviewId, {
    code: ReviewErrorCode.CANCELLED,
    message: "Review session cancelled by user.",
    reason: "user_cancelled",
  });
}

function cancelSessionWithError(
  reviewId: string,
  error: { code: ReviewErrorCode; message: string; reason: string },
): void {
  const session = activeSessions.get(reviewId);
  if (!session || session.isComplete) return;

  terminateSession(session, {
    code: error.code,
    message: error.message,
    reason: error.reason,
  });
  setTimeout(
    () => {
      activeSessions.delete(reviewId);
      unregisterSession(reviewId);
    },
    2 * 60 * 1000,
  ).unref();
}

export function cancelStaleSessionsForProjectMode(
  projectPath: string,
  mode: ReviewMode,
  headCommit: string,
  statusHash: string,
  statusHashKind: StatusHashKind,
  reviewConfigKey = "",
): void {
  // Without a verifiable head commit and status hash we cannot prove any session
  // is stale, so never cancel — an unavailable read must not abort live reviews.
  if (!headCommit || statusHashKind === "unavailable") {
    return;
  }

  for (const [reviewId, session] of activeSessions) {
    if (session.isComplete) continue;
    if (session.projectPath !== projectPath) continue;
    if (session.mode !== mode) continue;
    // A content-blind status-only session has no verifiable identity, so it is
    // neither cancelled as stale nor kept as a proof of unchanged state.
    if (isContentBlindStatusOnly(session.statusHashKind)) continue;
    // Only same-kind hashes are comparable; a content-blind hash cannot prove a
    // content-full session changed, so leave cross-kind sessions untouched.
    if (session.statusHashKind !== statusHashKind) continue;
    const gitStateMatches = session.headCommit === headCommit && session.statusHash === statusHash;
    if (gitStateMatches && session.reviewConfigKey === reviewConfigKey) {
      continue;
    }
    cancelSession(
      reviewId,
      gitStateMatches
        ? {
            message:
              "Review session cancelled: superseded by a review with a different configuration.",
          }
        : undefined,
    );
  }
}

export function subscribe(
  reviewId: string,
  callback: (event: FullReviewStreamEvent) => void,
): (() => void) | null {
  const session = activeSessions.get(reviewId);
  if (session) {
    session.subscribers.add(callback);
    return () => session.subscribers.delete(callback);
  }
  return null;
}

export function onSessionComplete(reviewId: string, callback: () => void): (() => void) | null {
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
    statusHashKind: StatusHashKind;
    mode: ReviewMode;
    scopeKey?: string;
    reviewConfigKey?: string;
  },
): ActiveSession | undefined {
  // An unverifiable hash cannot safely dedupe onto an existing session.
  if (options.statusHashKind === "unavailable") {
    return undefined;
  }
  let newestSession: ActiveSession | undefined;
  for (const session of activeSessions.values()) {
    // A status-only session cannot prove its diff content is unchanged, so it
    // must never be served as a dedupe/reload match.
    if (isContentBlindStatusOnly(session.statusHashKind)) {
      continue;
    }
    const matches =
      session.projectPath === projectPath &&
      session.headCommit === options.headCommit &&
      session.statusHash === options.statusHash &&
      session.statusHashKind === options.statusHashKind &&
      session.mode === options.mode &&
      (options.reviewConfigKey === undefined ||
        session.reviewConfigKey === options.reviewConfigKey) &&
      !session.isComplete &&
      session.isReady;
    if (!matches) {
      continue;
    }
    if (options.scopeKey !== undefined) {
      if (session.scopeKey !== options.scopeKey) {
        continue;
      }
      return session;
    }
    if (!newestSession || session.startedAt > newestSession.startedAt) {
      newestSession = session;
    }
  }
  return newestSession;
}

export function getSession(reviewId: string): ActiveSession | undefined {
  return activeSessions.get(reviewId);
}

export function deleteSession(reviewId: string): void {
  activeSessions.delete(reviewId);
  unregisterSession(reviewId);
}
