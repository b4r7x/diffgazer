import { resolve } from "node:path";
import type { Context } from "hono";
import { err } from "@diffgazer/core/result";
import { createError } from "@diffgazer/core/errors";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { errorResponse } from "../../shared/lib/http/response.js";
import { getProjectRoot } from "../../shared/lib/http/request.js";
import { isValidProjectPath } from "../../shared/lib/validation.js";
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
import { getActiveSessionForProject, getSession, cancelSession, deleteSession } from "./sessions.js";
import { handleStoreError } from "./errors.js";

export async function getReviewForProject(id: string, projectPath: string) {
  const result = await getStoredReview(id);
  if (!result.ok) return result;
  if (result.value.metadata.projectPath !== projectPath) {
    return err(createError("NOT_FOUND", "Review not found"));
  }
  return result;
}

export function getRequestedProjectPath(c: Context): string | Response {
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
  mode: ReviewMode,
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
  const session = getActiveSessionForProject(projectPath, headCommitResult.value, statusHashResult, mode);
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
}
