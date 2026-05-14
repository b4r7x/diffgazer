import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { getErrorMessage } from "@diffgazer/core/errors";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { errorResponse } from "../../shared/lib/http/response.js";
import { writeSSEError } from "../../shared/lib/http/sse.js";
import { getProjectRoot } from "../../shared/lib/http/request.js";
import { createGitService } from "../../shared/lib/git/service.js";
import { ok, err, type Result } from "@diffgazer/core/result";
import { cancelSession, getSession, type ActiveSession } from "./sessions.js";
import { streamActiveSessionToSSE } from "./sse-replay.js";

interface FreshnessFailure {
  code: typeof ReviewErrorCode.SESSION_STALE | typeof ErrorCode.INTERNAL_ERROR;
  message: string;
  status: 409 | 500;
}

async function assertSessionFresh(
  session: ActiveSession,
  projectPath: string,
): Promise<Result<void, FreshnessFailure>> {
  const gitService = createGitService({ cwd: projectPath });
  const [headCommitResult, currentStatusHash] = await Promise.all([
    gitService.getHeadCommit(),
    gitService.getStatusHash(),
  ]);

  if (!headCommitResult.ok) {
    return err({
      code: ErrorCode.INTERNAL_ERROR,
      message: "Failed to inspect repository state",
      status: 500,
    });
  }

  const currentHeadCommit = headCommitResult.value;
  if (
    currentHeadCommit !== session.headCommit ||
    currentStatusHash !== session.statusHash
  ) {
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
  const session = getSession(id);
  if (!session) {
    return errorResponse(c, "Session not found", ReviewErrorCode.SESSION_NOT_FOUND, 404);
  }

  const projectPath = getProjectRoot(c);
  if (session.projectPath !== projectPath) {
    return errorResponse(c, "Session not found", ReviewErrorCode.SESSION_NOT_FOUND, 404);
  }

  const freshness = await assertSessionFresh(session, projectPath);
  if (!freshness.ok) {
    if (freshness.error.code === ReviewErrorCode.SESSION_STALE) {
      cancelSession(id);
    }
    return errorResponse(c, freshness.error.message, freshness.error.code, freshness.error.status);
  }

  return streamSSE(c, async (stream) => {
    try {
      await streamActiveSessionToSSE(stream, session, c.req.raw.signal);
    } catch (error) {
      try {
        await writeSSEError(
          stream,
          getErrorMessage(error),
          ErrorCode.INTERNAL_ERROR,
        );
      } catch (e) {
        console.warn("SSE error write failed:", e);
      }
    }
  });
}
