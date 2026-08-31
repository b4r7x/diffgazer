/**
 * The live review session registry: which sessions exist, when one is evicted,
 * timed out, cancelled or torn down for shutdown, and which existing session an
 * incoming request dedupes onto. One session's record and its bounded event
 * buffer live in `session-buffer.ts`; the identity keys sessions are compared
 * by live in `scope-keys.ts`.
 */
import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import { ReviewErrorCode, type ReviewMode } from "@diffgazer/core/schemas/review";
import { log } from "../../../shared/lib/log.js";
import {
  registerSession,
  type SessionCancelOptions,
  unregisterSession,
} from "../../../shared/lib/session-registry.js";
import {
  type ActiveSession,
  capWarningEvent,
  notifyCompletion,
  notifySubscribers,
  type StatusHashKind,
  storeSessionEvent,
} from "./session-buffer.js";

export type { ActiveSession, StatusHashKind } from "./session-buffer.js";

function matchesConfigurationCancellation(
  session: ActiveSession,
  options?: SessionCancelOptions,
): boolean {
  if (!options?.configurationId) return true;
  if (session.configurationId !== options.configurationId) return false;
  if (
    options.configurationRevision !== undefined &&
    session.configurationRevision !== options.configurationRevision
  ) {
    return false;
  }
  if (
    options.admittedExecutionFingerprint &&
    session.admittedExecutionFingerprint !== options.admittedExecutionFingerprint
  ) {
    return false;
  }
  return true;
}

// A `status-only` session cannot prove its diff content is unchanged (the repo hash
// stays constant across edits that keep the same porcelain status line), so it must
// never be deduped onto or cancelled by identity — treated like `unavailable` for matching.
function isContentBlindStatusOnly(statusHashKind: StatusHashKind): boolean {
  return statusHashKind === "status-only";
}

const MAX_SESSIONS = 50;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const activeSessions = new Map<string, ActiveSession>();
const sessionClocks = new WeakMap<ActiveSession, () => number>();

function defaultMonotonicNow(): number {
  return performance.now();
}

function monotonicNowFor(session: ActiveSession): number {
  return (sessionClocks.get(session) ?? defaultMonotonicNow)();
}

// Partial writes started by a termination and still on their way to disk.
// Nothing waits on them inline — the abort below must not wait on the disk — but
// shutdown does, or `process.exit` beats the save the user is owed.
const pendingPartialPersists = new Set<Promise<void>>();
const SHUTDOWN_PERSIST_TIMEOUT_MS = 3_000;

function terminateSession(
  session: ActiveSession,
  options: { code: ReviewErrorCode; message: string; reason: string },
): void {
  const persisting = session.persistPartial?.();
  if (persisting) {
    const settled = persisting.catch((error) =>
      log("warn", "session_partial_persist_failed", { reviewId: session.reviewId, error }),
    );
    pendingPartialPersists.add(settled);
    void settled.finally(() => pendingPartialPersists.delete(settled));
  }
  session.controller.abort(options.reason);
  const event: FullReviewStreamEvent = {
    type: "error",
    error: {
      code: options.code,
      message: options.message,
    },
  };
  storeSessionEvent(session, event, monotonicNowFor(session));
  session.isComplete = true;
  notifySubscribers(session, event);
  session.subscribers.clear();
  notifyCompletion(session);
}

function canEvictSession(session: ActiveSession): boolean {
  return session.isComplete || session.persistenceState === "pending";
}

function evictOldestSession(): boolean {
  // Evict in cost order: a completed session is only a replay cache entry whose
  // result is already on disk, so discard those (oldest first) before aborting a
  // live review that is still spending tokens.
  let oldestCompleted: { id: string; startedAt: Date } | null = null;
  let oldestLive: { id: string; startedAt: Date } | null = null;
  for (const [id, session] of activeSessions) {
    if (!canEvictSession(session)) continue;
    const candidate = session.isComplete ? oldestCompleted : oldestLive;
    if (candidate && candidate.startedAt <= session.startedAt) continue;
    if (session.isComplete) {
      oldestCompleted = { id, startedAt: session.startedAt };
    } else {
      oldestLive = { id, startedAt: session.startedAt };
    }
  }
  const oldest = oldestCompleted ?? oldestLive;
  if (!oldest) return false;

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
  return true;
}

function trimSessionsToLimit(): void {
  while (activeSessions.size > MAX_SESSIONS) {
    if (!evictOldestSession()) return;
  }
}

// Terminate sessions idle past SESSION_TIMEOUT_MS with a SESSION_TIMEOUT error. Runs on
// the 5-minute cleanup interval and is exported so the timeout path is directly testable.
export function cleanupStaleSessions(): void {
  for (const [id, session] of activeSessions) {
    const idleTime = monotonicNowFor(session) - session.lastActivityTick;
    if (
      !session.isComplete &&
      session.persistenceState === "pending" &&
      idleTime > SESSION_TIMEOUT_MS
    ) {
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

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startSessionMaintenance(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(cleanupStaleSessions, 5 * 60 * 1000);
  cleanupInterval.unref();
}

startSessionMaintenance();

// The partial writes the shutdown terminations just started are the last chance
// to keep what those reviews produced, so shutdown waits for them — bounded, so
// a wedged disk cannot hold the process open instead.
async function drainPendingPartialPersists(): Promise<void> {
  if (pendingPartialPersists.size === 0) return;
  const saves = Promise.allSettled([...pendingPartialPersists]).then(() => "saved" as const);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), SHUTDOWN_PERSIST_TIMEOUT_MS);
    timer.unref();
  });
  const outcome = await Promise.race([saves, deadline]);
  clearTimeout(timer);
  if (outcome === "timeout") {
    log("warn", "session_partial_persist_timeout", { pending: pendingPartialPersists.size });
  }
}

// Tear down all in-memory session state for shutdown/SIGTERM and test teardown: clear
// the cleanup interval, abort in-flight work, emit a terminal error to subscribers, and
// clear subscribers/listeners so no SSE client keeps the process alive. Resolves once the
// partial writes those terminations started have landed (or the bound expires).
export async function shutdownSessions(): Promise<void> {
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

  await drainPendingPartialPersists();
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
    reviewInputHash?: string;
    provider?: string | null;
    configurationId?: string;
    configurationRevision?: number;
    admittedExecutionFingerprint?: string;
    leaseId?: string;
    monotonicNow?: () => number;
    persistPartial?: () => Promise<void>;
  },
): ActiveSession {
  startSessionMaintenance();
  if (activeSessions.size >= MAX_SESSIONS) {
    if (!evictOldestSession()) {
      log("warn", "session_capacity_deferred", {
        activeSessions: activeSessions.size,
        cap: MAX_SESSIONS,
      });
    }
  }

  const startedAt = new Date();
  const monotonicNow = options.monotonicNow ?? defaultMonotonicNow;
  const session: ActiveSession = {
    reviewId,
    projectPath: options.projectPath,
    headCommit: options.headCommit,
    statusHash: options.statusHash,
    statusHashKind: options.statusHashKind,
    mode: options.mode,
    scopeKey: options.scopeKey ?? "",
    reviewConfigKey: options.reviewConfigKey ?? "",
    reviewInputHash: options.reviewInputHash ?? "",
    provider: options.provider ?? null,
    configurationId: options.configurationId ?? null,
    configurationRevision: options.configurationRevision ?? null,
    admittedExecutionFingerprint: options.admittedExecutionFingerprint ?? null,
    leaseId: options.leaseId ?? null,
    startedAt,
    lastActivityTick: monotonicNow(),
    events: [],
    isComplete: false,
    isReady: false,
    persistenceState: "pending",
    capWarningEmitted: false,
    driftNoticeEmitted: false,
    persistPartial: options.persistPartial ?? null,
    subscribers: new Set(),
    completionListeners: new Set(),
    controller: new AbortController(),
  };
  sessionClocks.set(session, monotonicNow);
  activeSessions.set(reviewId, session);
  registerSession(reviewId, {
    projectKey: session.projectPath,
    configurationId: session.configurationId,
    configurationRevision: session.configurationRevision,
    admittedExecutionFingerprint: session.admittedExecutionFingerprint,
    leaseId: session.leaseId,
    cancel: (options?: SessionCancelOptions) => {
      if (session.isComplete) return;
      if (!matchesConfigurationCancellation(session, options)) return;
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

export function markCommitting(reviewId: string): boolean {
  const session = activeSessions.get(reviewId);
  if (!session || session.isComplete || session.persistenceState !== "pending") {
    return false;
  }
  session.persistenceState = "committing";
  return true;
}

export function markCommitted(reviewId: string): boolean {
  const session = activeSessions.get(reviewId);
  if (!session || session.persistenceState !== "committing") {
    return false;
  }
  session.persistenceState = "committed";
  return true;
}

/** Returns whether the event landed in the replay buffer; live delivery is unconditional. */
export function addEvent(reviewId: string, event: FullReviewStreamEvent): boolean {
  const session = activeSessions.get(reviewId);
  if (!session || session.isComplete) return false;

  const result = storeSessionEvent(session, event, monotonicNowFor(session));
  // First drop at the cap: store one notice (one-time overflow past the cap) so late
  // SSE replays see it, then stream it live.
  if (result.firstDrop) {
    const notice = capWarningEvent();
    if (result.stored) {
      session.events.splice(-1, 0, notice);
    } else {
      session.events.push(notice);
    }
    notifySubscribers(session, notice);
  }
  // The cap bounds the replay buffer only — live subscribers always receive the event,
  // otherwise a long-running review goes wire-silent past the cap and stalls clients.
  notifySubscribers(session, event);
  return result.stored;
}

// The diff a run reads is captured when it starts, so later worktree edits do
// not invalidate it. A resume that finds the repository moved says so once, as a
// notice, instead of killing work the user is still waiting for.
const DRIFT_NOTICE_CONTENT =
  "[diffgazer] The repository changed after this review started; these results describe the diff captured at the start.";

export function noteSessionDrift(reviewId: string): void {
  const session = activeSessions.get(reviewId);
  if (!session || session.isComplete || session.driftNoticeEmitted) return;
  // A resuming client subscribes only after this call, so the notice reaches it
  // through the replay buffer alone. Claim it as emitted only once it is buffered;
  // otherwise the next resume retries it.
  session.driftNoticeEmitted = addEvent(reviewId, {
    type: "chunk",
    content: DRIFT_NOTICE_CONTENT,
  });
}

export function markComplete(reviewId: string): void {
  const session = activeSessions.get(reviewId);
  if (session && !session.isComplete) {
    session.isComplete = true;
    session.subscribers.clear();
    notifyCompletion(session);
    trimSessionsToLimit();
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

export function cancelSessionForUser(
  reviewId: string,
): "cancelled" | "not-found" | "already-complete" | "already-committed" {
  const session = activeSessions.get(reviewId);
  if (!session) return "not-found";
  if (session.isComplete) return "already-complete";
  if (session.persistenceState !== "pending") {
    return "already-committed";
  }
  cancelSessionWithError(reviewId, {
    code: ReviewErrorCode.CANCELLED,
    message: "Review session cancelled by user.",
    reason: "user_cancelled",
  });
  return "cancelled";
}

function cancelSessionWithError(
  reviewId: string,
  error: { code: ReviewErrorCode; message: string; reason: string },
): void {
  const session = activeSessions.get(reviewId);
  if (!session || session.isComplete || session.persistenceState !== "pending") return;

  terminateSession(session, error);
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
  reviewInputHash?: string,
): void {
  // Without a verifiable head commit and status hash we cannot prove any session
  // is stale, so never cancel — an unavailable read must not abort live reviews.
  if (reviewInputHash === undefined && (!headCommit || statusHashKind === "unavailable")) {
    return;
  }

  for (const [reviewId, session] of activeSessions) {
    if (session.isComplete) continue;
    if (session.projectPath !== projectPath) continue;
    if (session.mode !== mode) continue;
    if (reviewInputHash !== undefined) {
      if (session.reviewInputHash === reviewInputHash) continue;
      const sameGitState = session.headCommit === headCommit && session.statusHash === statusHash;
      cancelSession(
        reviewId,
        sameGitState
          ? {
              message:
                "Review session cancelled: superseded by a review with a different configuration or diff.",
            }
          : undefined,
      );
      continue;
    }
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

export function hasReadySessionForProjectMode(projectPath: string, mode: ReviewMode): boolean {
  for (const session of activeSessions.values()) {
    if (
      session.projectPath === projectPath &&
      session.mode === mode &&
      session.isReady &&
      !session.isComplete
    ) {
      return true;
    }
  }
  return false;
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
    reviewInputHash?: string;
  },
): ActiveSession | undefined {
  // An unverifiable hash cannot safely dedupe onto an existing session.
  if (options.reviewInputHash === undefined && options.statusHashKind === "unavailable") {
    return undefined;
  }
  let newestSession: ActiveSession | undefined;
  for (const session of activeSessions.values()) {
    // A status-only session cannot prove its diff content is unchanged, so it
    // must never be served as a dedupe/reload match.
    if (options.reviewInputHash === undefined && isContentBlindStatusOnly(session.statusHashKind)) {
      continue;
    }
    const identityMatches =
      options.reviewInputHash === undefined
        ? session.headCommit === options.headCommit &&
          session.statusHash === options.statusHash &&
          session.statusHashKind === options.statusHashKind
        : session.headCommit === options.headCommit &&
          session.reviewInputHash === options.reviewInputHash;
    const matches =
      session.projectPath === projectPath &&
      identityMatches &&
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

export function deleteSessionForTests(reviewId: string): void {
  activeSessions.delete(reviewId);
  unregisterSession(reviewId);
}
