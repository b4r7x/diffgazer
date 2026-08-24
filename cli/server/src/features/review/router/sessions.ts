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
  type ErrorStatus,
  errorResponse,
  zodErrorHandler as handleZodError,
  type WireErrorCode,
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

function admissionFailureWire(code: AdmissionFailureCode): {
  readonly code: WireErrorCode;
  readonly status: ErrorStatus;
} {
  switch (code) {
    case "configuration-not-found":
      return { code: ErrorCode.NOT_FOUND, status: 404 };
    case "configuration-migration-required":
      return { code: "SECRETS_MIGRATION_FAILED", status: 503 };
    case "budget-exhausted":
      return { code: ErrorCode.RATE_LIMITED, status: 429 };
    case "adapter-unavailable":
      return { code: ErrorCode.INTERNAL_ERROR, status: 500 };
    // A review already holds the configuration's admitted capacity. That is a
    // conflict with the running review, not a setup condition: `SETUP_REQUIRED`
    // is a credential-setup code and would send the user to reconnect a provider
    // that is working.
    case "lease-denied":
      return { code: ErrorCode.REVIEW_IN_PROGRESS, status: 409 };
    case "configuration-revoking":
    case "configuration-unsupported":
    case "readiness-not-ready":
    case "acknowledgement-required":
    case "conformance-failed":
    case "tuple-changed":
      return { code: ErrorCode.SETUP_REQUIRED, status: 403 };
  }
}

function admissionFailureResponse(c: Context, failure: AdmissionFailure): Response {
  const wire = admissionFailureWire(failure.code);
  return errorResponse(c, failure.safeMessage, wire.code, wire.status);
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
    const selected = await resolveSelectedConfigurationId();
    if (!selected.ok) return admissionFailureResponse(c, selected.error);
    const configurationId = selected.value;
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
        let status: ErrorStatus = 500;
        if (result.error.code === ErrorCode.TRUST_REQUIRED) status = 403;
        else if (result.error.code === "SECRETS_MIGRATION_FAILED") status = 503;
        return errorResponse(c, result.error.message, result.error.code, status);
      }

      ownsRelease = result.value.session.leaseId !== authorization.lease.leaseId;

      const response: CreateReviewResponse = {
        reviewId: result.value.reviewId,
        session: toActiveReviewSessionResponse(result.value.session),
        outcome: result.value.outcome,
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
