import { getErrorMessage } from "@diffgazer/core/errors";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import { ReviewErrorCode, type TerminalOutcome } from "@diffgazer/core/schemas/review";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { createGitService } from "../../../shared/lib/git/service.js";
import { getProjectRoot } from "../../../shared/lib/http/request.js";
import { errorResponse } from "../../../shared/lib/http/response.js";
import { log } from "../../../shared/lib/log.js";
import { getProjectSessionGeneration } from "../../../shared/lib/session-registry.js";
import { hasRepoReadAccess } from "../../../shared/middlewares/trust-guard.js";
import { resolveGitDiff } from "../diff.js";
import { buildReviewInputHash } from "../service.js";
import { isTerminalEvent } from "./events.js";
import { streamActiveSessionToSSE } from "./replay.js";
import { writeSSEError } from "./sse.js";
import { type ActiveSession, getSession, noteSessionDrift } from "./store.js";

function findTerminalEvent(
  events: readonly FullReviewStreamEvent[],
): FullReviewStreamEvent | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event && isTerminalEvent(event)) return event;
  }
  return undefined;
}

function deriveSessionTerminalOutcome(session: ActiveSession): TerminalOutcome | "incomplete" {
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
  const sessionFingerprint = session.admittedExecutionFingerprint ?? undefined;
  if (!requestedFingerprint || !sessionFingerprint) return false;
  return requestedFingerprint !== sessionFingerprint;
}

function resumableSessionForReplay(session: ActiveSession): ActiveSession {
  const outcome = deriveSessionTerminalOutcome(session);
  if (session.isComplete && outcome !== "completed" && outcome !== "incomplete") {
    return {
      ...session,
      events: sanitizeReplayEvents(session.events, outcome),
    };
  }
  return session;
}

function scopeFilesFromKey(scopeKey: string): string[] | undefined {
  for (const part of scopeKey.split("|")) {
    if (!part.startsWith("f:")) continue;
    try {
      const parsed: unknown = JSON.parse(part.slice(2));
      if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string")) {
        return parsed;
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Whether the worktree still matches the state the session captured when it
 * started. A live run is never cancelled over this: the answer only decides
 * whether the resume carries a drift notice.
 */
async function isSessionFresh(session: ActiveSession, projectPath: string): Promise<boolean> {
  const gitService = createGitService({ cwd: projectPath });

  if (session.reviewInputHash) {
    const headCommitResult = await gitService.getHeadCommit();
    if (!headCommitResult.ok) return true;

    const currentHeadCommit = headCommitResult.value;
    if (currentHeadCommit !== session.headCommit) return false;

    const parsedResult = await resolveGitDiff({
      gitService,
      mode: session.mode,
      files: scopeFilesFromKey(session.scopeKey),
      emit: async () => undefined,
      reviewId: session.reviewId,
    });
    if (!parsedResult.ok) return true;

    const currentHash = buildReviewInputHash({
      headCommit: currentHeadCommit,
      reviewConfigKey: session.reviewConfigKey,
      parsed: parsedResult.value,
    });
    return currentHash === session.reviewInputHash;
  }

  const [headCommitResult, statusHashResult] = await Promise.all([
    gitService.getHeadCommit(),
    gitService.getStatusHash(),
  ]);

  if (!headCommitResult.ok || statusHashResult.kind === "unavailable") return true;

  const statusHashChanged =
    statusHashResult.kind === session.statusHashKind &&
    statusHashResult.hash !== session.statusHash;
  return headCommitResult.value === session.headCommit && !statusHashChanged;
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
  // their terminal event log within the retention window, and freshness-gating
  // them turns "commit the just-reviewed work" into a 409. A live session is
  // never gated either: its diff was captured at the start, so worktree drift
  // is worth a notice, not the loss of a run the user is still waiting for.
  // The notice is emitted once per session, so a session that already carries it
  // skips the freshness read entirely — it re-reads the diff off disk.
  if (!session.isComplete && !session.driftNoticeEmitted) {
    const isFresh = await isSessionFresh(session, projectPath);
    if (!isAuthorized()) {
      return errorResponse(c, "Repository access not granted", ErrorCode.TRUST_REQUIRED, 403);
    }
    const latestSession = getSession(id);
    if (!latestSession || latestSession.projectPath !== projectPath) {
      return errorResponse(c, "Session not found", ReviewErrorCode.SESSION_NOT_FOUND, 404);
    }
    session = latestSession;
    if (!isFresh) {
      noteSessionDrift(id);
    }
  }

  const replaySession = resumableSessionForReplay(session);

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
