import { resolve } from "node:path";
import { createError } from "@diffgazer/core/errors";
import { err } from "@diffgazer/core/result";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { zValidator } from "@hono/zod-validator";
import { type Context, Hono } from "hono";
import { getProjectRoot } from "../../../shared/lib/http/request.js";
import {
  errorResponse,
  zodErrorHandler as handleZodError,
} from "../../../shared/lib/http/response.js";
import { handleStoreError } from "../../../shared/lib/http/store-error.js";
import { requireRepoAccess } from "../../../shared/middlewares/trust-guard.js";
import { ReviewIdParamSchema, ReviewListQuerySchema } from "../schemas.js";
import { getReviewDetail as getStoredReviewDetail, listReviewPage } from "../storage/reviews.js";
import { isValidProjectPath, resolvesToSameProject } from "../validation.js";

const historyRouter = new Hono();

historyRouter.get(
  "/reviews",
  requireRepoAccess,
  zValidator("query", ReviewListQuerySchema, handleZodError),
  async (c): Promise<Response> => {
    const requested = await getRequestedProjectPath(c);
    if (!requested.ok) return requested.response;

    const { cursor, limit } = c.req.valid("query");
    const result = await listReviewPage(requested.projectPath, { cursor, limit });
    if (!result.ok) return handleStoreError(c, result.error);

    return c.json({
      reviews: result.value.items,
      nextCursor: result.value.nextCursor,
      ...(result.value.warnings.length > 0 ? { warnings: result.value.warnings } : {}),
    });
  },
);

historyRouter.get(
  "/reviews/:id",
  requireRepoAccess,
  zValidator("param", ReviewIdParamSchema, handleZodError),
  async (c): Promise<Response> => {
    const { id } = c.req.valid("param");
    const result = await getReviewForProject(id, getProjectRoot(c));
    if (!result.ok) return handleStoreError(c, result.error);
    const { diff: _diff, ...review } = result.value.review;
    return c.json({
      review,
      ...(result.value.warnings.length > 0 ? { warnings: result.value.warnings } : {}),
    });
  },
);

async function getReviewForProject(id: string, projectPath: string) {
  const result = await getStoredReviewDetail(id);
  if (!result.ok) return result;
  if (result.value.review.metadata.projectPath !== projectPath) {
    return err(createError("NOT_FOUND", "Review not found"));
  }
  return result;
}

type RequestedProjectPath = { ok: true; projectPath: string } | { ok: false; response: Response };

async function getRequestedProjectPath(c: Context): Promise<RequestedProjectPath> {
  const projectPath = getProjectRoot(c);
  const queryProjectPath = c.req.query("projectPath");
  if (!queryProjectPath) return { ok: true, projectPath };

  if (!isValidProjectPath(queryProjectPath)) {
    return {
      ok: false,
      response: errorResponse(c, "Invalid project path", ErrorCode.INVALID_PATH, 400),
    };
  }

  // The requested path must identify the request's project root. The fast string
  // check covers the common exact-match case; the realpath check follows symlinks
  // so a spoofed or traversal path that resolves elsewhere is rejected.
  const matchesProject =
    resolve(queryProjectPath) === projectPath ||
    (await resolvesToSameProject(queryProjectPath, projectPath));
  if (!matchesProject) {
    return {
      ok: false,
      response: errorResponse(
        c,
        "projectPath does not match request project",
        ErrorCode.VALIDATION_ERROR,
        400,
      ),
    };
  }

  return { ok: true, projectPath };
}

export { historyRouter };
