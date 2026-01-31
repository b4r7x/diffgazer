import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { streamTriageToSSE } from "../../services/triage.js";
import { initializeAIClient } from "../../lib/ai-client.js";
import { errorResponse, handleStoreError } from "../../lib/response.js";
import { requireUuidParam, validateProjectPath } from "../../lib/validation.js";
import { writeSSEError } from "../../lib/sse-helpers.js";
import {
  listTriageReviews,
  getTriageReview,
  deleteTriageReview,
  addDrilldownToReview,
} from "../../storage/index.js";
import { drilldownIssueById } from "../../review/index.js";
import { parseDiff } from "../../diff/index.js";
import { getErrorMessage } from "@repo/core";
import { ErrorCode } from "@repo/schemas/errors";
import { createGitService } from "../../services/git.js";
import type { LensId, ProfileId } from "@repo/schemas/lens";

const triage = new Hono();

triage.get("/stream", async (c) => {
  console.log("[ROUTE:STREAM] Request received", c.req.url);

  const clientResult = await initializeAIClient();
  if (!clientResult.ok) {
    console.error("[ROUTE:STREAM] AI client init failed:", clientResult.error);
    return errorResponse(c, clientResult.error.message, clientResult.error.code, 500);
  }
  console.log("[ROUTE:STREAM] AI client initialized");

  const staged = c.req.query("staged") !== "false";
  const lensesParam = c.req.query("lenses");
  const filesParam = c.req.query("files");
  const profile = c.req.query("profile") as ProfileId | undefined;

  const lenses = lensesParam
    ? (lensesParam.split(",") as LensId[])
    : undefined;

  const files = filesParam
    ? filesParam.split(",").map((f) => f.trim()).filter(Boolean)
    : undefined;

  console.log("[ROUTE:STREAM] Params:", { staged, lenses, files, profile });

  return streamSSE(c, async (stream) => {
    console.log("[ROUTE:SSE] Stream started");
    try {
      await streamTriageToSSE(clientResult.value, { staged, files, lenses, profile }, stream);
      console.log("[ROUTE:SSE] streamTriageToSSE completed");
    } catch (error) {
      console.error("[ROUTE:SSE] Error:", error);
      try {
        await writeSSEError(stream, getErrorMessage(error), ErrorCode.INTERNAL_ERROR);
      } catch {
        // Stream already closed, cannot send error
      }
    }
  });
});

triage.get("/reviews", async (c) => {
  const projectPath = validateProjectPath(c.req.query("projectPath"));
  const result = await listTriageReviews(projectPath);

  if (!result.ok) {
    return errorResponse(c, result.error.message, result.error.code, 500);
  }

  return c.json({
    reviews: result.value.items,
    warnings: result.value.warnings.length > 0 ? result.value.warnings : undefined,
  });
});

triage.get("/reviews/:id", async (c) => {
  const reviewId = requireUuidParam(c, "id");
  const result = await getTriageReview(reviewId);

  if (!result.ok) {
    return errorResponse(c, result.error.message, result.error.code, 404);
  }

  return c.json({ review: result.value });
});

triage.delete("/reviews/:id", async (c) => {
  const reviewId = requireUuidParam(c, "id");
  const result = await deleteTriageReview(reviewId);

  if (!result.ok) {
    return errorResponse(c, result.error.message, result.error.code, 500);
  }

  return c.json({ existed: result.value.existed });
});

triage.post("/reviews/:id/drilldown", async (c) => {
  const reviewId = requireUuidParam(c, "id");

  const clientResult = await initializeAIClient();
  if (!clientResult.ok) {
    return errorResponse(c, clientResult.error.message, clientResult.error.code, 500);
  }

  const body = await c.req.json<{ issueId: string }>();
  if (!body.issueId) {
    return errorResponse(c, "issueId is required", "VALIDATION_ERROR", 400);
  }

  const reviewResult = await getTriageReview(reviewId);
  if (!reviewResult.ok) {
    return errorResponse(c, reviewResult.error.message, reviewResult.error.code, 404);
  }

  const review = reviewResult.value;
  const gitService = createGitService();
  const diff = await gitService.getDiff(review.metadata.staged);
  const parsed = parseDiff(diff);

  const drilldownResult = await drilldownIssueById(
    clientResult.value,
    body.issueId,
    review.result,
    parsed
  );

  if (!drilldownResult.ok) {
    return errorResponse(c, drilldownResult.error.message, drilldownResult.error.code, 400);
  }

  await addDrilldownToReview(reviewId, drilldownResult.value);

  return c.json({ drilldown: drilldownResult.value });
});

export { triage };
