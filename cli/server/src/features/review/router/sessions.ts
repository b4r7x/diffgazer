import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { ActiveReviewSession, CreateReviewResponse } from "@diffgazer/core/schemas/review";
import { zValidator } from "@hono/zod-validator";
import { type Context, Hono, type Next } from "hono";
import {
  type AdmissionFailure,
  type AdmissionFailureCode,
  authorizeReviewExecution,
} from "../../../shared/lib/ai/admission/service.js";
import {
  createAdmissionServiceDependencies,
  resolveSelectedConfigurationId,
  toInitializedAIClient,
} from "../../../shared/lib/ai/client/initialize.js";
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
    return errorResponse(
      c,
      "Content-Type must be application/json",
      ErrorCode.VALIDATION_ERROR,
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

function admissionFailureStatus(code: AdmissionFailureCode): number {
  switch (code) {
    case "configuration-not-found":
      return 404;
    case "budget-exhausted":
      return 429;
    case "configuration-removed":
    case "configuration-revoking":
    case "configuration-unsupported":
    case "readiness-not-ready":
    case "acknowledgement-required":
    case "evidence-missing":
    case "evidence-skipped":
    case "evidence-stale":
    case "evidence-hash-mismatch":
    case "tuple-changed":
    case "adapter-unavailable":
    case "lease-denied":
      return 403;
    default:
      return 500;
  }
}

function admissionFailureResponse(c: Context, failure: AdmissionFailure): Response {
  const status = admissionFailureStatus(failure.code) as 403 | 404 | 429 | 500;
  return c.json({ error: { message: failure.safeMessage, code: failure.code } }, status);
}

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
    const configurationId = resolveSelectedConfigurationId();
    if (!configurationId) {
      return errorResponse(
        c,
        "No provider configuration is selected",
        ErrorCode.VALIDATION_ERROR,
        400,
      );
    }

    const authorizationResult = await authorizeReviewExecution(
      configurationId,
      createAdmissionServiceDependencies(),
    );
    if (!authorizationResult.ok) {
      return admissionFailureResponse(c, authorizationResult.error);
    }

    // The reservation and lease are held from here on. This scope owns their
    // release until a created session adopts the lease; every other exit —
    // validation failure, dedupe onto an existing session, or a throw — gives
    // the admitted capacity straight back instead of leaking it.
    const authorization = authorizationResult.value;
    let ownsRelease = true;
    try {
      const client = toInitializedAIClient(authorization);
      const projectPath = getProjectRoot(c);
      const generation = getProjectSessionGeneration(projectPath);
      const result = await createReviewSession(client, {
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

      ownsRelease = result.value.session.leaseId !== authorization.lease.leaseId;

      const response: CreateReviewResponse = {
        reviewId: result.value.reviewId,
        session: toActiveReviewSessionResponse(result.value.session),
      };
      return c.json(response);
    } finally {
      if (ownsRelease) authorization.release();
    }
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
