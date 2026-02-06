import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { ErrorCode } from "@stargazer/schemas/errors";
import { errorResponse, handleStoreError, zodErrorHandler } from "../../shared/lib/http/response.js";
import { createBodyLimitMiddleware } from "../../shared/middlewares/body-limit.js";
import { getErrorMessage } from "@stargazer/core";
import { parseDiff } from "../../shared/lib/diff/parser.js";
import { createGitService } from "../../shared/lib/git/service.js";
import { writeSSEError } from "../../shared/lib/http/sse.js";
import { getProjectRoot, parseProjectPath } from "../../shared/lib/http/request.js";
import { getProjectStargazerDir } from "../../shared/lib/paths.js";
import { isValidProjectPath } from "../../shared/lib/validation.js";
import { requireRepoAccess } from "../../shared/middlewares/trust-guard.js";
import {
  addDrilldownToReview,
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
import { streamReviewToSSE } from "./service.js";
import { buildProjectContextSnapshot, loadContextSnapshot } from "./context.js";
import { drilldownIssueById } from "./drilldown.js";

const reviewRouter = new Hono();

const bodyLimitMiddleware = createBodyLimitMiddleware(50);

reviewRouter.get("/stream", requireRepoAccess, zValidator("query", ReviewStreamQuerySchema, zodErrorHandler), async (c): Promise<Response> => {
  const clientResult = initializeAIClient();
  if (!clientResult.ok) {
    return errorResponse(c, clientResult.error.message, clientResult.error.code, 500);
  }

  const { mode: modeParam, profile, lenses, files: filesParam } = c.req.valid("query");
  const mode = modeParam ?? "unstaged";

  const files = parseCsvParam(filesParam);
  const projectPath = getProjectRoot(c);

  return streamSSE(c, async (stream) => {
    try {
      await streamReviewToSSE(
        clientResult.value,
        { mode, files, lenses, profile, projectPath },
        stream
      );
    } catch (error) {
      try {
        await writeSSEError(stream, getErrorMessage(error), ErrorCode.INTERNAL_ERROR);
      } catch {
        // Stream already closed
      }
    }
  });
});

reviewRouter.get("/context", requireRepoAccess, async (c): Promise<Response> => {
  const projectRoot = getProjectRoot(c);
  if (!isValidProjectPath(projectRoot)) {
    return errorResponse(c, "Invalid project path", ErrorCode.INVALID_PATH, 400);
  }

  const contextDir = getProjectStargazerDir(projectRoot);
  const snapshot = await loadContextSnapshot(contextDir);

  if (!snapshot) {
    return errorResponse(c, "Context snapshot not found", ErrorCode.NOT_FOUND, 404);
  }

  return c.json({
    text: snapshot.markdown,
    markdown: snapshot.markdown,
    graph: snapshot.graph,
    meta: snapshot.meta,
  });
});

reviewRouter.post(
  "/context/refresh",
  bodyLimitMiddleware,
  requireRepoAccess,
  zValidator("json", ContextRefreshSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const projectRoot = getProjectRoot(c);
    if (!isValidProjectPath(projectRoot)) {
      return errorResponse(c, "Invalid project path", ErrorCode.INVALID_PATH, 400);
    }

    const { force } = c.req.valid("json");

    try {
      const snapshot = await buildProjectContextSnapshot(projectRoot, { force });
      return c.json({
        text: snapshot.markdown,
        markdown: snapshot.markdown,
        graph: snapshot.graph,
        meta: snapshot.meta,
      });
    } catch (error) {
      return errorResponse(c, getErrorMessage(error), ErrorCode.INTERNAL_ERROR, 500);
    }
  }
);

reviewRouter.get("/reviews", async (c): Promise<Response> => {
  const projectPathResult = parseProjectPath(c);
  if (!projectPathResult.ok) return projectPathResult.response;

  const result = await listStoredReviews(projectPathResult.value);
  if (!result.ok) return handleStoreError(c, result.error);

  return c.json({
    reviews: result.value.items,
    ...(result.value.warnings.length > 0 ? { warnings: result.value.warnings } : {}),
  });
});

reviewRouter.get(
  "/reviews/:id",
  zValidator("param", ReviewIdParamSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const { id } = c.req.valid("param");
    const result = await getStoredReview(id);
    if (!result.ok) return handleStoreError(c, result.error);

    return c.json({ review: result.value });
  }
);

reviewRouter.delete(
  "/reviews/:id",
  zValidator("param", ReviewIdParamSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const { id } = c.req.valid("param");
    const result = await deleteStoredReview(id);
    if (!result.ok) return handleStoreError(c, result.error);

    return c.json({ existed: result.value.existed });
  }
);

reviewRouter.post(
  "/reviews/:id/drilldown",
  bodyLimitMiddleware,
  requireRepoAccess,
  zValidator("param", ReviewIdParamSchema, zodErrorHandler),
  zValidator("json", DrilldownRequestSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const { id } = c.req.valid("param");
    const { issueId } = c.req.valid("json");

    const clientResult = initializeAIClient();
    if (!clientResult.ok) {
      return errorResponse(c, clientResult.error.message, clientResult.error.code, 500);
    }

    const reviewResult = await getStoredReview(id);
    if (!reviewResult.ok) return handleStoreError(c, reviewResult.error);

    const projectPath = getProjectRoot(c);
    const gitService = createGitService({ cwd: projectPath });

    let diff: string;
    try {
      diff = await gitService.getDiff(reviewResult.value.metadata.mode ?? "unstaged");
    } catch {
      return errorResponse(c, "Failed to retrieve git diff", ErrorCode.COMMAND_FAILED, 500);
    }

    const parsed = parseDiff(diff);
    const drilldownResult = await drilldownIssueById(
      clientResult.value,
      issueId,
      reviewResult.value.result,
      parsed
    );

    if (!drilldownResult.ok) {
      return errorResponse(c, drilldownResult.error.message, drilldownResult.error.code, 400);
    }

    const saveResult = await addDrilldownToReview(id, drilldownResult.value);
    if (!saveResult.ok) return handleStoreError(c, saveResult.error);

    return c.json({ drilldown: drilldownResult.value });
  }
);

export { reviewRouter };
