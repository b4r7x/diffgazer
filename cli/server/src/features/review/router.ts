import { resolve } from "node:path";
import { createError, getErrorMessage } from "@diffgazer/core/errors";
import { err } from "@diffgazer/core/result";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { ActiveReviewSession, CreateReviewResponse } from "@diffgazer/core/schemas/review";
import { zValidator } from "@hono/zod-validator";
import { type Context, Hono, type Next } from "hono";
import { initializeAIClient } from "../../shared/lib/ai/client.js";
import { createGitService } from "../../shared/lib/git/service.js";
import { getProjectRoot } from "../../shared/lib/http/request.js";
import {
  type ErrorStatus,
  errorResponse,
  zodErrorHandler as handleZodError,
} from "../../shared/lib/http/response.js";
import { log } from "../../shared/lib/log.js";
import { getProjectDiffgazerDir } from "../../shared/lib/paths.js";
import { getProjectSessionGeneration } from "../../shared/lib/session-registry.js";
import {
  CREATE_REVIEW_BODY_LIMIT_KB,
  createBodyLimitMiddleware,
  DEFAULT_BODY_LIMIT_KB,
} from "../../shared/middlewares/body-limit.js";
import { createRateLimitMiddleware } from "../../shared/middlewares/rate-limit.js";
import { requireSetup } from "../../shared/middlewares/setup-guard.js";
import { hasRepoReadAccess, requireRepoAccess } from "../../shared/middlewares/trust-guard.js";
import { buildProjectContextSnapshot, loadContextSnapshot } from "./context/snapshot.js";
import { handleDrilldownRequest } from "./drilldown.js";
import { handleStoreError } from "./errors.js";
import {
  ActiveSessionQuerySchema,
  ContextRefreshSchema,
  CreateReviewBodySchema,
  DrilldownRequestSchema,
  ReviewIdParamSchema,
  ReviewListQuerySchema,
} from "./schemas.js";
import { createReviewSession } from "./service.js";
import {
  deleteReview as deleteStoredReview,
  getReview as getStoredReview,
  listReviewPage,
} from "./storage/reviews.js";
import { resumeStreamById } from "./stream/resume.js";
import {
  type ActiveSession,
  cancelSessionForUser,
  deleteSession,
  getActiveSessionForProject,
  getSession,
  hasReadySessionForProjectMode,
} from "./stream/store.js";
import type { HandleDrilldownError } from "./types.js";
import { isValidProjectPath, resolvesToSameProject } from "./validation.js";

const reviewRouter = new Hono();

async function requireJsonContentType(c: Context, next: Next): Promise<Response | undefined> {
  const contentType = c.req.header("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return c.json(
      {
        error: {
          message: "Content-Type must be application/json",
          code: ErrorCode.VALIDATION_ERROR,
        },
      },
      415,
    );
  }
  await next();
  return undefined;
}

const reviewCreationBodyLimit = createBodyLimitMiddleware(CREATE_REVIEW_BODY_LIMIT_KB);
const bodyLimitMiddleware = createBodyLimitMiddleware(DEFAULT_BODY_LIMIT_KB);
const reviewCreationLimit = createRateLimitMiddleware("review:create", {
  maxRequests: 10,
  windowMs: 60_000,
});
const drilldownLimit = createRateLimitMiddleware("review:drilldown", {
  maxRequests: 20,
  windowMs: 60_000,
});

function toActiveReviewSessionResponse(session: ActiveSession): ActiveReviewSession {
  return {
    reviewId: session.reviewId,
    mode: session.mode,
    startedAt: session.startedAt.toISOString(),
    headCommit: session.headCommit,
    statusHash: session.statusHash,
  };
}

reviewRouter.post(
  "/reviews",
  reviewCreationBodyLimit,
  requireJsonContentType,
  reviewCreationLimit,
  requireSetup,
  requireRepoAccess,
  zValidator("json", CreateReviewBodySchema, handleZodError),
  async (c): Promise<Response> => {
    const body = c.req.valid("json");
    const clientResult = await initializeAIClient();
    if (!clientResult.ok) {
      return errorResponse(c, clientResult.error.message, clientResult.error.code, 500);
    }

    const projectPath = getProjectRoot(c);
    const generation = getProjectSessionGeneration(projectPath);
    const result = await createReviewSession(clientResult.value, {
      mode: body.mode ?? "unstaged",
      files: body.files,
      lenses: body.lenses,
      profile: body.profile,
      projectPath,
      activation: {
        generation,
        isAuthorized: () => hasRepoReadAccess(projectPath),
      },
    });

    if (!result.ok) {
      const status = result.error.code === ErrorCode.TRUST_REQUIRED ? 403 : 500;
      return errorResponse(c, result.error.message, result.error.code, status);
    }

    const response: CreateReviewResponse = {
      reviewId: result.value.reviewId,
      session: toActiveReviewSessionResponse(result.value.session),
    };
    return c.json(response);
  },
);

reviewRouter.get(
  "/reviews/:id/stream",
  requireRepoAccess,
  zValidator("param", ReviewIdParamSchema, handleZodError),
  resumeStreamById,
);

reviewRouter.get(
  "/sessions/active",
  requireRepoAccess,
  zValidator("query", ActiveSessionQuerySchema, handleZodError),
  async (c): Promise<Response> => {
    const query = c.req.valid("query");
    const projectPath = getProjectRoot(c);
    const mode = query.mode ?? "unstaged";
    if (!hasReadySessionForProjectMode(projectPath, mode)) {
      return c.json({ session: null });
    }

    const gitService = createGitService({ cwd: projectPath });

    const [headCommitResult, statusHashResult] = await Promise.all([
      gitService.getHeadCommit(),
      gitService.getStatusHash(),
    ]);
    if (!headCommitResult.ok) {
      return errorResponse(c, "Failed to inspect repository state", ErrorCode.INTERNAL_ERROR, 500);
    }

    if (statusHashResult.kind === "unavailable") {
      return c.json({ session: null });
    }
    // Match regardless of scopeKey so a client reloading during a scoped
    // (files/lenses/profile) review can resume it -- only mode is constrained.
    const session = getActiveSessionForProject(projectPath, {
      headCommit: headCommitResult.value,
      statusHash: statusHashResult.hash,
      statusHashKind: statusHashResult.kind,
      mode,
    });
    if (!session) {
      return c.json({ session: null });
    }

    return c.json({ session: toActiveReviewSessionResponse(session) });
  },
);

reviewRouter.delete(
  "/sessions/:id",
  requireRepoAccess,
  zValidator("param", ReviewIdParamSchema, handleZodError),
  (c): Response => {
    const { id } = c.req.valid("param");
    const session = getSession(id);
    if (!session || session.projectPath !== getProjectRoot(c)) {
      return c.json({ cancelled: true, reason: "not-found" });
    }
    const reason = cancelSessionForUser(id);
    return c.json({ cancelled: true, reason });
  },
);

reviewRouter.get("/context", requireSetup, requireRepoAccess, async (c): Promise<Response> => {
  const projectRoot = getProjectRoot(c);
  if (!isValidProjectPath(projectRoot)) {
    return errorResponse(c, "Invalid project path", ErrorCode.INVALID_PATH, 400);
  }

  const contextDir = getProjectDiffgazerDir(projectRoot);
  const snapshot = await loadContextSnapshot(contextDir);

  if (!snapshot || !snapshot.markdown.trim()) {
    return errorResponse(c, "Context snapshot not found", ErrorCode.NOT_FOUND, 404);
  }

  // `text` and `markdown` carry the same content; the web client offers both a
  // plain-text and a Markdown download of the snapshot from these two fields.
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
      return c.json({
        text: snapshot.markdown,
        markdown: snapshot.markdown,
        graph: snapshot.graph,
        meta: snapshot.meta,
      });
    } catch (error) {
      log("error", "context_refresh_failed", { error: getErrorMessage(error) });
      return errorResponse(c, "Failed to refresh project context", ErrorCode.INTERNAL_ERROR, 500);
    }
  },
);

reviewRouter.get(
  "/reviews",
  requireRepoAccess,
  zValidator("query", ReviewListQuerySchema.passthrough(), handleZodError),
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

reviewRouter.get(
  "/reviews/:id",
  requireRepoAccess,
  zValidator("param", ReviewIdParamSchema, handleZodError),
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
  zValidator("param", ReviewIdParamSchema, handleZodError),
  async (c): Promise<Response> => {
    const { id } = c.req.valid("param");
    const projectPath = getProjectRoot(c);
    const existing = await getStoredReview(id);
    if (!existing.ok) {
      if (existing.error.code === "NOT_FOUND") {
        return c.json({ existed: false });
      }
      return handleStoreError(c, existing.error);
    }
    if (existing.value.metadata.projectPath !== projectPath) {
      return c.json({ existed: false });
    }

    const result = await deleteStoredReview(id, projectPath);
    if (!result.ok) return handleStoreError(c, result.error);
    if (result.value.existed) {
      deleteSession(id);
    }
    return c.json({ existed: result.value.existed });
  },
);

reviewRouter.post(
  "/reviews/:id/drilldown",
  bodyLimitMiddleware,
  drilldownLimit,
  requireSetup,
  requireRepoAccess,
  zValidator("param", ReviewIdParamSchema, handleZodError),
  zValidator("json", DrilldownRequestSchema, handleZodError),
  async (c): Promise<Response> => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const projectPath = getProjectRoot(c);
    const reviewResult = await getReviewForProject(id, projectPath);
    if (!reviewResult.ok) return handleStoreError(c, reviewResult.error);

    const clientResult = await initializeAIClient();
    if (!clientResult.ok) {
      return errorResponse(c, clientResult.error.message, clientResult.error.code, 500);
    }

    const result = await handleDrilldownRequest(clientResult.value, id, body.issueId, projectPath, {
      review: reviewResult.value,
      signal: c.req.raw.signal,
    });

    if (!result.ok) {
      return errorResponse(
        c,
        result.error.message,
        result.error.code,
        drilldownErrorStatus(result.error.code),
      );
    }

    return c.json({ drilldown: result.value });
  },
);

async function getReviewForProject(id: string, projectPath: string) {
  const result = await getStoredReview(id);
  if (!result.ok) return result;
  if (result.value.metadata.projectPath !== projectPath) {
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

function drilldownErrorStatus(code: HandleDrilldownError["code"]): ErrorStatus {
  switch (code) {
    case "ISSUE_NOT_FOUND":
    case "NOT_FOUND":
      return 404;
    case "VALIDATION_ERROR":
      return 400;
    default:
      return 500;
  }
}

export { reviewRouter };
