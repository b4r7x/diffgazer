import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import {
  type ExecutionResult,
  ReviewErrorCode,
  TERMINAL_OUTCOMES,
  type TerminalOutcome,
} from "@diffgazer/core/schemas/review";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { createGitService } from "../../../shared/lib/git/service.js";
import { getProjectRoot } from "../../../shared/lib/http/request.js";
import { errorResponse } from "../../../shared/lib/http/response.js";
import { log } from "../../../shared/lib/log.js";
import { getProjectSessionGeneration } from "../../../shared/lib/session-registry.js";
import { hasRepoReadAccess } from "../../../shared/middlewares/trust-guard.js";
import { isTerminalEvent } from "./events.js";
import { streamActiveSessionToSSE } from "./replay.js";
import { writeSSEError } from "./sse.js";
import { type ActiveSession, cancelSession, getSession } from "./store.js";

interface FreshnessFailure {
  code: typeof ReviewErrorCode.SESSION_STALE;
  message: string;
  status: 409;
}

const FAILED_TERMINAL_OUTCOMES = TERMINAL_OUTCOMES.filter(
  (outcome): outcome is Exclude<TerminalOutcome, "completed"> => outcome !== "completed",
);

const sessionExecutions = new Map<string, ExecutionResult>();

/** Binds the immutable admitted execution snapshot for stream resume validation. */
export function bindSessionExecution(reviewId: string, execution: ExecutionResult): void {
  sessionExecutions.set(reviewId, execution);
}

export function clearSessionExecution(reviewId: string): void {
  sessionExecutions.delete(reviewId);
}

export function getBoundSessionExecution(reviewId: string): ExecutionResult | undefined {
  return sessionExecutions.get(reviewId);
}

function findTerminalEvent(
  events: readonly FullReviewStreamEvent[],
): FullReviewStreamEvent | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event && isTerminalEvent(event)) return event;
  }
  return undefined;
}

export function deriveSessionTerminalOutcome(
  session: ActiveSession,
): TerminalOutcome | "incomplete" {
  const bound = sessionExecutions.get(session.reviewId);
  if (bound) return bound.receipt.outcome;

  const terminal = findTerminalEvent(session.events);
  if (!terminal) return "incomplete";
  if (terminal.type === "complete") return "completed";
  if (terminal.type === "error") {
    if (terminal.error.code === ReviewErrorCode.CANCELLED) return "cancelled";
    if (terminal.error.code === ReviewErrorCode.SESSION_TIMEOUT) return "timed-out";
    return "transport-failed";
  }
  return "incomplete";
}

function sanitizeReplayEvents(
  events: readonly FullReviewStreamEvent[],
  outcome: TerminalOutcome | "incomplete",
): FullReviewStreamEvent[] {
  if (outcome === "completed") return [...events];

  return events.map((event) => {
    if (event.type !== "complete") return event;
    return {
      ...event,
      result: { issues: [] },
    };
  });
}

function executionFingerprintMismatch(
  session: ActiveSession,
  requestedFingerprint: string | undefined,
): boolean {
  const bound = sessionExecutions.get(session.reviewId);
  const sessionFingerprint =
    bound?.receipt.executionFingerprint ?? session.admittedExecutionFingerprint ?? undefined;
  if (!requestedFingerprint || !sessionFingerprint) return false;
  return requestedFingerprint !== sessionFingerprint;
}

function resumableSessionForReplay(session: ActiveSession): ActiveSession | FreshnessFailure {
  const outcome = deriveSessionTerminalOutcome(session);
  if (session.isComplete && outcome !== "completed" && outcome !== "incomplete") {
    return {
      ...session,
      events: sanitizeReplayEvents(session.events, outcome),
    };
  }
  if (session.isComplete && outcome === "completed") {
    const bound = sessionExecutions.get(session.reviewId);
    if (bound && bound.receipt.outcome !== "completed") {
      return {
        ...session,
        events: sanitizeReplayEvents(session.events, bound.receipt.outcome),
      };
    }
  }
  return session;
}

async function assertSessionFresh(
  session: ActiveSession,
  projectPath: string,
): Promise<Result<void, FreshnessFailure>> {
  const gitService = createGitService({ cwd: projectPath });
  const [headCommitResult, statusHashResult] = await Promise.all([
    gitService.getHeadCommit(),
    gitService.getStatusHash(),
  ]);

  // A repository-inspection failure (head-commit or status) means we cannot
  // verify freshness — not that the repo changed. Keep streaming without a 409
  // or a destructive cancel, so a transient git slowdown during reconnect never
  // aborts a healthy in-flight review.
  if (!headCommitResult.ok || statusHashResult.kind === "unavailable") {
    return ok(undefined);
  }

  const currentHeadCommit = headCommitResult.value;
  const statusHashChanged =
    statusHashResult.kind === session.statusHashKind &&
    statusHashResult.hash !== session.statusHash;
  if (currentHeadCommit !== session.headCommit || statusHashChanged) {
    return err({
      code: ReviewErrorCode.SESSION_STALE,
      message: "Session is stale: repository state changed. Start a new review.",
      status: 409,
    });
  }

  return ok(undefined);
}

export async function resumeStreamById(c: Context): Promise<Response> {
  const id = c.req.param("id");
  if (!id) {
    return errorResponse(c, "Session not found", ReviewErrorCode.SESSION_NOT_FOUND, 404);
  }

  let session = getSession(id);
  if (!session) {
    return errorResponse(c, "Session not found", ReviewErrorCode.SESSION_NOT_FOUND, 404);
  }

  const projectPath = getProjectRoot(c);
  if (session.projectPath !== projectPath) {
    return errorResponse(c, "Session not found", ReviewErrorCode.SESSION_NOT_FOUND, 404);
  }

  const requestedFingerprint = c.req.query("executionFingerprint");
  if (executionFingerprintMismatch(session, requestedFingerprint)) {
    return errorResponse(
      c,
      "Session execution fingerprint does not match the admitted plan.",
      ReviewErrorCode.SESSION_STALE,
      409,
    );
  }

  const generation = getProjectSessionGeneration(projectPath);
  const isAuthorized = () =>
    getProjectSessionGeneration(projectPath) === generation && hasRepoReadAccess(projectPath);
  if (!isAuthorized()) {
    return errorResponse(c, "Repository access not granted", ErrorCode.TRUST_REQUIRED, 403);
  }

  // Completed sessions are retained precisely so the replay layer can serve
  // their terminal event log within the retention window. Freshness-gating them
  // turns "commit the just-reviewed work" into a 409, so skip the check (and the
  // destructive cancel) and go straight to replay.
  if (!session.isComplete) {
    const freshness = await assertSessionFresh(session, projectPath);
    if (!isAuthorized()) {
      return errorResponse(c, "Repository access not granted", ErrorCode.TRUST_REQUIRED, 403);
    }
    const latestSession = getSession(id);
    if (!latestSession || latestSession.projectPath !== projectPath) {
      return errorResponse(c, "Session not found", ReviewErrorCode.SESSION_NOT_FOUND, 404);
    }
    session = latestSession;
    if (!freshness.ok && !session.isComplete) {
      cancelSession(id);
      return errorResponse(
        c,
        freshness.error.message,
        freshness.error.code,
        freshness.error.status,
      );
    }
  }

  const replaySession = resumableSessionForReplay(session);
  if ("status" in replaySession) {
    return errorResponse(c, replaySession.message, replaySession.code, replaySession.status);
  }

  return streamSSE(c, async (stream) => {
    try {
      await streamActiveSessionToSSE(stream, replaySession, c.req.raw.signal, isAuthorized);
    } catch (error) {
      try {
        await writeSSEError(stream, getErrorMessage(error), ReviewErrorCode.GENERATION_FAILED);
      } catch (e) {
        log("warn", "sse_error_write_failed", { error: e });
      }
    }
  });
}

export { FAILED_TERMINAL_OUTCOMES };
