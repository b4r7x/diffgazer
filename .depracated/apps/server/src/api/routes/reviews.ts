import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  reviewStore,
  listReviews,
  getTriageReview,
} from "../../storage/index.js";
import { handleStoreError, errorResponse } from "../../lib/response.js";
import { requireUuidParam, validateProjectPath } from "../../lib/validation.js";
import { getSession, subscribe } from "../../storage/active-sessions.js";
import { ErrorCode } from "@repo/schemas/errors";

export const reviews = new Hono();

reviews.get("/", async (c) => {
  const projectPath = validateProjectPath(c.req.query("projectPath"));
  const result = await listReviews(projectPath);

  if (!result.ok) return handleStoreError(c, result.error);

  return c.json({
    reviews: result.value.items,
    ...(result.value.warnings.length > 0 && { warnings: result.value.warnings }),
  });
});

reviews.get("/:id", async (c) => {
  const reviewId = requireUuidParam(c, "id");
  const result = await reviewStore.read(reviewId);

  if (!result.ok) return handleStoreError(c, result.error);

  return c.json({ review: result.value });
});

reviews.delete("/:id", async (c) => {
  const reviewId = requireUuidParam(c, "id");
  const result = await reviewStore.remove(reviewId);

  if (!result.ok) return handleStoreError(c, result.error);

  return c.json({ existed: result.value.existed });
});

reviews.get("/:id/stream", async (c) => {
  const reviewId = requireUuidParam(c, "id");
  const session = getSession(reviewId);

  if (!session) {
    return errorResponse(c, "Session not found", ErrorCode.NOT_FOUND, 404);
  }

  const writeEvent = (stream: any, event: any) =>
    stream.writeSSE({
      event: event.type,
      data: JSON.stringify(event),
    });

  return streamSSE(c, async (stream) => {
    for (const event of session.events) {
      await writeEvent(stream, event);
    }

    if (session.isComplete) return;

    await new Promise<void>((resolve) => {
      const unsubscribe = subscribe(reviewId, async (event) => {
        await writeEvent(stream, event);
        if (event.type === "complete" || event.type === "error") {
          unsubscribe();
          resolve();
        }
      });
    });
  });
});

reviews.get("/:id/status", async (c) => {
  const reviewId = requireUuidParam(c, "id");
  const session = getSession(reviewId);
  const savedResult = await getTriageReview(reviewId);

  if (session) {
    return c.json({
      sessionActive: true,
      reviewSaved: savedResult.ok,
      isComplete: session.isComplete,
      startedAt: session.startedAt.toISOString(),
    });
  }

  if (savedResult.ok) {
    return c.json({
      sessionActive: false,
      reviewSaved: true,
      isComplete: true,
      startedAt: savedResult.value.metadata.createdAt,
    });
  }

  return c.json({
    sessionActive: false,
    reviewSaved: false,
    isComplete: false,
  });
});
