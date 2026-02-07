import type { Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { ErrorCode } from "@stargazer/schemas/errors";
import {
  errorResponse,
  zodErrorHandler,
} from "../../shared/lib/http/response.js";
import { createBodyLimitMiddleware } from "../../shared/middlewares/body-limit.js";
import { getErrorMessage } from "@stargazer/core/errors";
import { writeSSEError } from "../../shared/lib/http/sse.js";
import { getProjectRoot } from "../../shared/lib/http/request.js";
import { getProjectStargazerDir } from "../../shared/lib/paths.js";
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
import { ReviewErrorCode } from "@stargazer/schemas/review";
import { cancelSession, getSession } from "./sessions.js";
import { parseProjectPath, handleStoreError } from "./utils.js";

const reviewRouter = new Hono();

const bodyLimitMiddleware = createBodyLimitMiddleware(50);

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
      await streamActiveSessionToSSE(stream, session);
    } catch (error) {
      try {
        await writeSSEError(
          stream,
          getErrorMessage(error),
          ErrorCode.INTERNAL_ERROR,
        );
      } catch {
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
        } catch {
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

    const contextDir = getProjectStargazerDir(projectRoot);
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
  const projectPathResult = parseProjectPath(c);
  if (!projectPathResult.ok) return projectPathResult.response;

  const result = await listStoredReviews(projectPathResult.value);
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
    const result = await getStoredReview(id);
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
    const result = await deleteStoredReview(id);
    if (!result.ok) return handleStoreError(c, result.error);

    return c.json({ existed: result.value.existed });
  },
);

reviewRouter.post(
  "/reviews/:id/drilldown",
  bodyLimitMiddleware,
  requireSetup,
  zValidator("param", ReviewIdParamSchema, zodErrorHandler),
  zValidator("json", DrilldownRequestSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const { id } = c.req.valid("param");
    const { issueId } = c.req.valid("json");

    const clientResult = initializeAIClient();
    if (!clientResult.ok) {
      return errorResponse(
        c,
        clientResult.error.message,
        clientResult.error.code,
        500,
      );
    }

    const projectPath = getProjectRoot(c);
    const result = await handleDrilldownRequest(
      clientResult.value,
      id,
      issueId,
      projectPath,
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
