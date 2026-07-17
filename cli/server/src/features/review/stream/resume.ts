import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { createGitService } from "../../../shared/lib/git/service.js";
import { getProjectRoot } from "../../../shared/lib/http/request.js";
import { errorResponse } from "../../../shared/lib/http/response.js";
import { log } from "../../../shared/lib/log.js";
import { getProjectSessionGeneration } from "../../../shared/lib/session-registry.js";
import { hasRepoReadAccess } from "../../../shared/middlewares/trust-guard.js";
import { streamActiveSessionToSSE } from "./replay.js";
import { writeSSEError } from "./sse.js";
import { type ActiveSession, cancelSession, getSession } from "./store.js";

interface FreshnessFailure {
  code: typeof ReviewErrorCode.SESSION_STALE;
  message: string;
  status: 409;
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

  return streamSSE(c, async (stream) => {
    try {
      await streamActiveSessionToSSE(stream, session, c.req.raw.signal, isAuthorized);
    } catch (error) {
      try {
        await writeSSEError(stream, getErrorMessage(error), ReviewErrorCode.GENERATION_FAILED);
      } catch (e) {
        log("warn", "sse_error_write_failed", { error: e });
      }
    }
  });
}
