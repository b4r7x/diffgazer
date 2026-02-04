import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { ErrorCode } from "@repo/schemas/errors";
import type { LensId, ProfileId } from "@repo/schemas/lens";
import type { ReviewMode } from "@repo/schemas/triage-storage";
import { errorResponse, handleStoreError, zodErrorHandler } from "../../shared/lib/response.js";
import { getErrorMessage } from "../../shared/lib/errors.js";
import { parseDiff } from "../../shared/lib/diff/index.js";
import { createGitService } from "../../shared/lib/services/git.js";
import { drilldownIssueById } from "../../shared/lib/review/index.js";
import { writeSSEError } from "../../shared/lib/sse-helpers.js";
import { getProjectRoot } from "../../shared/lib/request.js";
import { isValidProjectPath } from "../../shared/lib/validation.js";
import {
  addDrilldownToReview,
  deleteTriageReview,
  getTriageReview,
  listTriageReviews,
} from "../../shared/lib/storage/index.js";
import { DrilldownRequestSchema, TriageReviewIdParamSchema } from "./schemas.js";
import { initializeAIClient } from "../../shared/lib/ai-client.js";
import { streamTriageToSSE } from "./service.js";

const triageRouter = new Hono();

const parseCsvParam = (value: string | undefined | null): string[] | undefined => {
  if (!value) return undefined;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
};

const invalidProjectPathResponse = (c: Context): Response =>
  errorResponse(
    c,
    "Invalid projectPath: contains path traversal or null bytes",
    ErrorCode.VALIDATION_ERROR,
    400
  );

const parseProjectPath = (
  c: Context
): { ok: true; value?: string } | { ok: false; response: Response } => {
  const projectPath = c.req.query("projectPath");
  if (!projectPath) return { ok: true, value: undefined };
  if (!isValidProjectPath(projectPath)) {
    return { ok: false, response: invalidProjectPathResponse(c) };
  }
  return { ok: true, value: projectPath };
};

triageRouter.get("/stream", async (c): Promise<Response> => {
  const clientResult = initializeAIClient();
  if (!clientResult.ok) {
    return errorResponse(c, clientResult.error.message, clientResult.error.code, 500);
  }

  const modeParam = c.req.query("mode") as ReviewMode | undefined;
  const stagedParam = c.req.query("staged");

  let mode: ReviewMode = "unstaged";
  if (modeParam) {
    mode = modeParam;
  } else if (stagedParam !== undefined) {
    mode = stagedParam !== "false" ? "staged" : "unstaged";
  }

  const profile = c.req.query("profile") as ProfileId | undefined;
  const lenses = parseCsvParam(c.req.query("lenses")) as LensId[] | undefined;
  const files = parseCsvParam(c.req.query("files"));
  const projectPath = getProjectRoot(c);

  return streamSSE(c, async (stream) => {
    try {
      await streamTriageToSSE(
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

triageRouter.get("/reviews", async (c): Promise<Response> => {
  const projectPathResult = parseProjectPath(c);
  if (!projectPathResult.ok) return projectPathResult.response;

  const result = await listTriageReviews(projectPathResult.value);
  if (!result.ok) return handleStoreError(c, result.error);

  return c.json({
    reviews: result.value.items,
    ...(result.value.warnings.length > 0 ? { warnings: result.value.warnings } : {}),
  });
});

triageRouter.get(
  "/reviews/:id",
  zValidator("param", TriageReviewIdParamSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const { id } = c.req.valid("param");
    const result = await getTriageReview(id);
    if (!result.ok) return handleStoreError(c, result.error);

    return c.json({ review: result.value });
  }
);

triageRouter.delete(
  "/reviews/:id",
  zValidator("param", TriageReviewIdParamSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const { id } = c.req.valid("param");
    const result = await deleteTriageReview(id);
    if (!result.ok) return handleStoreError(c, result.error);

    return c.json({ existed: result.value.existed });
  }
);

triageRouter.post(
  "/reviews/:id/drilldown",
  zValidator("param", TriageReviewIdParamSchema, zodErrorHandler),
  zValidator("json", DrilldownRequestSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const { id } = c.req.valid("param");
    const { issueId } = c.req.valid("json");

    const clientResult = initializeAIClient();
    if (!clientResult.ok) {
      return errorResponse(c, clientResult.error.message, clientResult.error.code, 500);
    }

    const reviewResult = await getTriageReview(id);
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

export { triageRouter };
