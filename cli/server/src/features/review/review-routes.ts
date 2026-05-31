import { resolve } from "node:path";
import type { Context } from "hono";
import { err } from "@diffgazer/core/result";
import { createError } from "@diffgazer/core/errors";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { errorResponse, type ErrorStatus } from "../../shared/lib/http/response.js";
import { getProjectRoot } from "../../shared/lib/http/request.js";
import { isValidProjectPath, resolvesToSameProject } from "../../shared/lib/validation.js";
import { createGitService } from "../../shared/lib/git/service.js";
import {
  deleteReview as deleteStoredReview,
  getReview as getStoredReview,
  listReviews as listStoredReviews,
} from "../../shared/lib/storage/reviews.js";
import { initializeAIClient } from "../../shared/lib/ai/client.js";
import { createReviewSession } from "./service.js";
import { handleDrilldownRequest } from "./drilldown.js";
import { ReviewErrorCode, type ReviewMode } from "@diffgazer/core/schemas/review";
import { buildScopeKey, getActiveSessionForProject, getSession, cancelSession, deleteSession } from "./sessions.js";
import type { LensId, ProfileId } from "@diffgazer/core/schemas/review";
import { handleStoreError } from "./errors.js";
import type { HandleDrilldownError } from "./types.js";

export async function getReviewForProject(id: string, projectPath: string) {
  const result = await getStoredReview(id);
  if (!result.ok) return result;
  if (result.value.metadata.projectPath !== projectPath) {
    return err(createError("NOT_FOUND", "Review not found"));
  }
  return result;
}

type RequestedProjectPath =
  | { ok: true; projectPath: string }
  | { ok: false; response: Response };

export async function getRequestedProjectPath(c: Context): Promise<RequestedProjectPath> {
  const projectPath = getProjectRoot(c);
  const queryProjectPath = c.req.query("projectPath");
  if (!queryProjectPath) return { ok: true, projectPath };

  if (!isValidProjectPath(queryProjectPath)) {
    return { ok: false, response: errorResponse(c, "Invalid project path", ErrorCode.INVALID_PATH, 400) };
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
      response: errorResponse(c, "projectPath does not match request project", ErrorCode.VALIDATION_ERROR, 400),
    };
  }

  return { ok: true, projectPath };
}

export async function createReviewHandler(
  c: Context,
  body: {
    mode?: ReviewMode;
    profile?: import("@diffgazer/core/schemas/review").ProfileId;
    lenses?: import("@diffgazer/core/schemas/review").LensId[];
    files?: string[];
  },
): Promise<Response> {
  const clientResult = initializeAIClient();
  if (!clientResult.ok) {
    return errorResponse(c, clientResult.error.message, clientResult.error.code, 500);
  }

  const projectPath = getProjectRoot(c);
  const result = await createReviewSession(clientResult.value, {
    mode: body.mode ?? "unstaged",
    files: body.files,
    lenses: body.lenses,
    profile: body.profile,
    projectPath,
  });

  if (!result.ok) {
    return errorResponse(c, result.error.message, result.error.code, 500);
  }

  return c.json({ reviewId: result.value.reviewId });
}

export async function getActiveSessionHandler(
  c: Context,
  query: {
    mode: ReviewMode;
    profile?: ProfileId;
    lenses?: LensId[];
    files?: string[];
  },
): Promise<Response> {
  const projectPath = getProjectRoot(c);
  const gitService = createGitService({ cwd: projectPath });

  const [headCommitResult, statusHashResult] = await Promise.all([
    gitService.getHeadCommit(),
    gitService.getStatusHash(),
  ]);
  if (!headCommitResult.ok) {
    return errorResponse(c, "Failed to inspect repository state", ErrorCode.INTERNAL_ERROR, 500);
  }

  if (statusHashResult === null) {
    return c.json({ session: null });
  }
  const scopeKey = buildScopeKey({
    files: query.files,
    lenses: query.lenses,
    profile: query.profile,
  });
  const session = getActiveSessionForProject(projectPath, {
    headCommit: headCommitResult.value,
    statusHash: statusHashResult,
    mode: query.mode,
    scopeKey,
  });
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
}

export async function listReviewsHandler(c: Context): Promise<Response> {
  const requested = await getRequestedProjectPath(c);
  if (!requested.ok) return requested.response;

  const result = await listStoredReviews(requested.projectPath);
  if (!result.ok) return handleStoreError(c, result.error);

  return c.json({
    reviews: result.value.items,
    ...(result.value.warnings.length > 0
      ? { warnings: result.value.warnings }
      : {}),
  });
}

export async function getReviewHandler(c: Context, id: string): Promise<Response> {
  const result = await getReviewForProject(id, getProjectRoot(c));
  if (!result.ok) return handleStoreError(c, result.error);
  return c.json({ review: result.value });
}

export async function deleteReviewHandler(c: Context, id: string): Promise<Response> {
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
}

export async function cancelSessionHandler(c: Context, id: string): Promise<Response> {
  const session = getSession(id);
  if (!session) {
    return c.json({ cancelled: false });
  }
  if (session.projectPath !== getProjectRoot(c)) {
    return c.json({ cancelled: false });
  }
  if (session.isComplete) {
    return c.json({ cancelled: false });
  }
  cancelSession(id);
  return c.json({ cancelled: true });
}

export async function drilldownHandler(
  c: Context,
  id: string,
  body: { issueId: string },
): Promise<Response> {
  const projectPath = getProjectRoot(c);
  const reviewResult = await getReviewForProject(id, projectPath);
  if (!reviewResult.ok) return handleStoreError(c, reviewResult.error);

  const clientResult = initializeAIClient();
  if (!clientResult.ok) {
    return errorResponse(c, clientResult.error.message, clientResult.error.code, 500);
  }

  const result = await handleDrilldownRequest(
    clientResult.value,
    id,
    body.issueId,
    projectPath,
    { review: reviewResult.value, signal: c.req.raw.signal },
  );

  if (!result.ok) {
    return errorResponse(c, result.error.message, result.error.code, drilldownErrorStatus(result.error.code));
  }

  return c.json({ drilldown: result.value });
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
