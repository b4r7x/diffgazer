import { resolve } from "node:path";
import type { Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { err } from "@diffgazer/core/result";
import { createError } from "@diffgazer/core/errors";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import {
  errorResponse,
  zodErrorHandler,
} from "../../shared/lib/http/response.js";
import { createBodyLimitMiddleware } from "../../shared/middlewares/body-limit.js";
import { getErrorMessage } from "@diffgazer/core/errors";
import { writeSSEError } from "../../shared/lib/http/sse.js";
import { getProjectRoot } from "../../shared/lib/http/request.js";
import { getProjectDiffgazerDir } from "../../shared/lib/paths.js";
import { isValidProjectPath } from "../../shared/lib/validation.js";
import { createGitService } from "../../shared/lib/git/service.js";
import { requireSetup } from "../../shared/middlewares/setup-guard.js";
import { requireRepoAccess } from "../../shared/middlewares/trust-guard.js";
import {
  deleteReview as deleteStoredReview,
  getReview as getStoredReview,
  listReviews as listStoredReviews,
} from "../../shared/lib/storage/reviews.js";
import {
  ActiveSessionQuerySchema,
  ContextRefreshSchema,
  DrilldownRequestSchema,
  ReviewIdParamSchema,
  ReviewStreamQuerySchema,
  parseCsvParam,
} from "./schemas.js";
import { initializeAIClient } from "../../shared/lib/ai/client.js";
import { streamActiveSessionToSSE, streamReviewToSSE } from "./service.js";
import { buildProjectContextSnapshot, loadContextSnapshot } from "./context.js";
import { handleDrilldownRequest } from "./drilldown.js";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { cancelSession, getActiveSessionForProject, getSession } from "./sessions.js";
import { handleStoreError } from "./errors.js";

const reviewRouter = new Hono();

const bodyLimitMiddleware = createBodyLimitMiddleware(50);

async function getReviewForProject(id: string, projectPath: string) {
  const result = await getStoredReview(id);
  if (!result.ok) return result;
  if (result.value.metadata.projectPath !== projectPath) {
    return err(createError("NOT_FOUND", "Review not found"));
  }
  return result;
}

function getRequestedProjectPath(c: Context): string | Response {
  const projectPath = getProjectRoot(c);
  const queryProjectPath = c.req.query("projectPath");
  if (!queryProjectPath) return projectPath;

  if (!isValidProjectPath(queryProjectPath)) {
    return errorResponse(c, "Invalid project path", ErrorCode.INVALID_PATH, 400);
  }

  if (resolve(queryProjectPath) !== projectPath) {
    return errorResponse(c, "projectPath does not match request project", ErrorCode.VALIDATION_ERROR, 400);
  }

  return projectPath;
}

const resumeStreamById = async (c: Context): Promise<Response> => {
  const id = c.req.param("id");
  const session = getSession(id);
  if (!session) {
    return errorResponse(c, "Session not found", ReviewErrorCode.SESSION_NOT_FOUND, 404);
  }

  const projectPath = getProjectRoot(c);
  if (session.projectPath !== projectPath) {
    return errorResponse(c, "Session not found", ReviewErrorCode.SESSION_NOT_FOUND, 404);
  }

  const gitService = createGitService({ cwd: projectPath });
  const [headCommitResult, currentStatusHash] = await Promise.all([
    gitService.getHeadCommit(),
    gitService.getStatusHash(),
  ]);
  if (!headCommitResult.ok) {
    return errorResponse(
      c,
      "Failed to inspect repository state",
      ErrorCode.INTERNAL_ERROR,
      500,
    );
  }
  const currentHeadCommit = headCommitResult.value;

  if (
    currentHeadCommit !== session.headCommit ||
    currentStatusHash !== session.statusHash
  ) {
    cancelSession(id);
    return errorResponse(
      c,
      "Session is stale: repository state changed. Start a new review.",
      ReviewErrorCode.SESSION_STALE,
      409,
    );
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
};

reviewRouter.get(
  "/stream",
  requireSetup,
  requireRepoAccess,
  zValidator("query", ReviewStreamQuerySchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const clientResult = initializeAIClient();
    if (!clientResult.ok) {
      return errorResponse(
        c,
        clientResult.error.message,
        clientResult.error.code,
        500,
      );
    }

    const {
      mode: modeParam,
      profile,
      lenses,
      files: filesParam,
    } = c.req.valid("query");
    const mode = modeParam ?? "unstaged";

    const files = parseCsvParam(filesParam);
    const projectPath = getProjectRoot(c);

    return streamSSE(c, async (stream) => {
      try {
        await streamReviewToSSE(
          clientResult.value,
          { mode, files, lenses, profile, projectPath },
          stream,
          c.req.raw.signal,
        );
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
  },
);

reviewRouter.get(
  "/reviews/:id/stream",
  requireSetup,
  requireRepoAccess,
  zValidator("param", ReviewIdParamSchema, zodErrorHandler),
  resumeStreamById,
);

reviewRouter.get(
  "/sessions/active",
  requireSetup,
  requireRepoAccess,
  zValidator("query", ActiveSessionQuerySchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const { mode: modeParam } = c.req.valid("query");
    const mode = modeParam ?? "unstaged";
    const projectPath = getProjectRoot(c);
    const gitService = createGitService({ cwd: projectPath });

    let headCommit: string;
    let statusHash: string;
    try {
      const [headCommitResult, currentStatusHash] = await Promise.all([
        gitService.getHeadCommit(),
        gitService.getStatusHash(),
      ]);
      if (!headCommitResult.ok) {
        return errorResponse(
          c,
          "Failed to inspect repository state",
          ErrorCode.INTERNAL_ERROR,
          500,
        );
      }
      headCommit = headCommitResult.value;
      statusHash = currentStatusHash;
    } catch {
      return errorResponse(
        c,
        "Failed to inspect repository state",
        ErrorCode.INTERNAL_ERROR,
        500,
      );
    }

    const session = getActiveSessionForProject(
      projectPath,
      headCommit,
      statusHash,
      mode,
    );
    if (!session) {
      return c.json({ session: null });
    }

    return c.json({
      session: {
        reviewId: session.reviewId,
        mode: session.mode,
        startedAt: session.startedAt.toISOString(),
        headCommit: session.headCommit,
        statusHash: session.statusHash,
      },
    });
  },
);

reviewRouter.get(
  "/context",
  requireSetup,
  requireRepoAccess,
  async (c): Promise<Response> => {
    const projectRoot = getProjectRoot(c);
    if (!isValidProjectPath(projectRoot)) {
      return errorResponse(
        c,
        "Invalid project path",
        ErrorCode.INVALID_PATH,
        400,
      );
    }

    const contextDir = getProjectDiffgazerDir(projectRoot);
    const snapshot = await loadContextSnapshot(contextDir);

    if (!snapshot) {
      return errorResponse(
        c,
        "Context snapshot not found",
        ErrorCode.NOT_FOUND,
        404,
      );
    }

    return c.json({
      text: snapshot.markdown,
      markdown: snapshot.markdown,
      graph: snapshot.graph,
      meta: snapshot.meta,
    });
  },
);

reviewRouter.post(
  "/context/refresh",
  bodyLimitMiddleware,
  requireSetup,
  requireRepoAccess,
  zValidator("json", ContextRefreshSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const projectRoot = getProjectRoot(c);
    if (!isValidProjectPath(projectRoot)) {
      return errorResponse(
        c,
        "Invalid project path",
        ErrorCode.INVALID_PATH,
        400,
      );
    }

    const { force } = c.req.valid("json");

    try {
      const snapshot = await buildProjectContextSnapshot(projectRoot, {
        force,
      });
      return c.json({
        text: snapshot.markdown,
        markdown: snapshot.markdown,
        graph: snapshot.graph,
        meta: snapshot.meta,
      });
    } catch (error) {
      return errorResponse(
        c,
        getErrorMessage(error),
        ErrorCode.INTERNAL_ERROR,
        500,
      );
    }
  },
);

reviewRouter.get("/reviews", requireRepoAccess, async (c): Promise<Response> => {
  const projectPath = getRequestedProjectPath(c);
  if (projectPath instanceof Response) return projectPath;

  const result = await listStoredReviews(projectPath);
  if (!result.ok) return handleStoreError(c, result.error);

  return c.json({
    reviews: result.value.items,
    ...(result.value.warnings.length > 0
      ? { warnings: result.value.warnings }
      : {}),
  });
});

reviewRouter.get(
  "/reviews/:id",
  requireRepoAccess,
  zValidator("param", ReviewIdParamSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const { id } = c.req.valid("param");
    const result = await getReviewForProject(id, getProjectRoot(c));
    if (!result.ok) return handleStoreError(c, result.error);

    return c.json({ review: result.value });
  },
);

reviewRouter.delete(
  "/reviews/:id",
  requireRepoAccess,
  zValidator("param", ReviewIdParamSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const { id } = c.req.valid("param");
    const existing = await getStoredReview(id);
    if (!existing.ok) {
      if (existing.error.code === "NOT_FOUND") {
        return c.json({ existed: false });
      }
      return handleStoreError(c, existing.error);
    }
    if (existing.value.metadata.projectPath !== getProjectRoot(c)) {
      return c.json({ existed: false });
    }

    const result = await deleteStoredReview(id);
    if (!result.ok) return handleStoreError(c, result.error);
    return c.json({ existed: result.value.existed });
  },
);

reviewRouter.post(
  "/reviews/:id/drilldown",
  bodyLimitMiddleware,
  requireSetup,
  requireRepoAccess,
  zValidator("param", ReviewIdParamSchema, zodErrorHandler),
  zValidator("json", DrilldownRequestSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const { id } = c.req.valid("param");
    const { issueId } = c.req.valid("json");
    const projectPath = getProjectRoot(c);
    const reviewResult = await getReviewForProject(id, projectPath);
    if (!reviewResult.ok) return handleStoreError(c, reviewResult.error);

    const clientResult = initializeAIClient();
    if (!clientResult.ok) {
      return errorResponse(
        c,
        clientResult.error.message,
        clientResult.error.code,
        500,
      );
    }

    const result = await handleDrilldownRequest(
      clientResult.value,
      id,
      issueId,
      projectPath,
      { review: reviewResult.value },
    );

    if (!result.ok) {
      const code = result.error.code;
      let status: 400 | 404 | 500 = 500;
      if (code === "ISSUE_NOT_FOUND" || code === "NOT_FOUND") {
        status = 404;
      } else if (code === "VALIDATION_ERROR") {
        status = 400;
      }
      return errorResponse(c, result.error.message, code, status);
    }

    return c.json({ drilldown: result.value });
  },
);

export { reviewRouter };
