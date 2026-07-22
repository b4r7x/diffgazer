import { getErrorMessage } from "@diffgazer/core/errors";
import { buildReviewContextResponse } from "@diffgazer/core/review";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { getProjectRoot } from "../../../shared/lib/http/request.js";
import {
  errorResponse,
  zodErrorHandler as handleZodError,
} from "../../../shared/lib/http/response.js";
import { log } from "../../../shared/lib/log.js";
import { getProjectDiffgazerDir } from "../../../shared/lib/paths.js";
import {
  createBodyLimitMiddleware,
  DEFAULT_BODY_LIMIT_KB,
} from "../../../shared/middlewares/body-limit.js";
import { requireSetup } from "../../../shared/middlewares/setup-guard.js";
import { requireRepoAccess } from "../../../shared/middlewares/trust-guard.js";
import { loadContextSnapshot } from "../context/snapshot/artifacts.js";
import { buildProjectContextSnapshot } from "../context/snapshot/build.js";
import { ContextRefreshSchema } from "../schemas.js";
import { isValidProjectPath } from "../validation.js";

const contextRouter = new Hono();

const bodyLimitMiddleware = createBodyLimitMiddleware(DEFAULT_BODY_LIMIT_KB);

contextRouter.get("/context", requireSetup, requireRepoAccess, async (c): Promise<Response> => {
  const projectRoot = getProjectRoot(c);
  if (!isValidProjectPath(projectRoot)) {
    return errorResponse(c, "Invalid project path", ErrorCode.INVALID_PATH, 400);
  }

  const contextDir = getProjectDiffgazerDir(projectRoot);
  const snapshot = await loadContextSnapshot(contextDir);

  if (!snapshot || !snapshot.markdown.trim()) {
    return errorResponse(c, "Context snapshot not found", ErrorCode.NOT_FOUND, 404);
  }

  return c.json(buildReviewContextResponse(snapshot));
});

contextRouter.post(
  "/context/refresh",
  bodyLimitMiddleware,
  requireSetup,
  requireRepoAccess,
  zValidator("json", ContextRefreshSchema, handleZodError),
  async (c): Promise<Response> => {
    const body = c.req.valid("json");
    const projectRoot = getProjectRoot(c);
    if (!isValidProjectPath(projectRoot)) {
      return errorResponse(c, "Invalid project path", ErrorCode.INVALID_PATH, 400);
    }

    try {
      const snapshot = await buildProjectContextSnapshot(projectRoot, {
        force: body.force,
      });
      return c.json(buildReviewContextResponse(snapshot));
    } catch (error) {
      log("error", "context_refresh_failed", { error: getErrorMessage(error) });
      return errorResponse(c, "Failed to refresh project context", ErrorCode.INTERNAL_ERROR, 500);
    }
  },
);

export { contextRouter };
