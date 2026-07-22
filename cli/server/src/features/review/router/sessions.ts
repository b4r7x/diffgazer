import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { ActiveReviewSession, CreateReviewResponse } from "@diffgazer/core/schemas/review";
import { zValidator } from "@hono/zod-validator";
import { type Context, Hono, type Next } from "hono";
import { initializeAIClient } from "../../../shared/lib/ai/client/initialize.js";
import { createGitService } from "../../../shared/lib/git/service.js";
import { getProjectRoot } from "../../../shared/lib/http/request.js";
import {
  errorResponse,
  zodErrorHandler as handleZodError,
} from "../../../shared/lib/http/response.js";
import { getProjectSessionGeneration } from "../../../shared/lib/session-registry.js";
import {
  CREATE_REVIEW_BODY_LIMIT_KB,
  createBodyLimitMiddleware,
} from "../../../shared/middlewares/body-limit.js";
import { createRateLimitMiddleware } from "../../../shared/middlewares/rate-limit.js";
import { requireSetup } from "../../../shared/middlewares/setup-guard.js";
import { hasRepoReadAccess, requireRepoAccess } from "../../../shared/middlewares/trust-guard.js";
import {
  ActiveSessionQuerySchema,
  CreateReviewBodySchema,
  ReviewIdParamSchema,
} from "../schemas.js";
import { createReviewSession } from "../service.js";
import { resumeStreamById } from "../stream/resume.js";
import {
  type ActiveSession,
  cancelSessionForUser,
  getActiveSessionForProject,
  getSession,
  hasReadySessionForProjectMode,
} from "../stream/store.js";

const sessionsRouter = new Hono();

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
const reviewCreationLimit = createRateLimitMiddleware("review:create", {
  maxRequests: 10,
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

sessionsRouter.post(
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

sessionsRouter.get(
  "/reviews/:id/stream",
  requireRepoAccess,
  zValidator("param", ReviewIdParamSchema, handleZodError),
  resumeStreamById,
);

sessionsRouter.get(
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

sessionsRouter.delete(
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

export { sessionsRouter };
