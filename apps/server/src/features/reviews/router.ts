import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { ErrorCode } from "@repo/schemas/errors";
import { deleteReview, getReview, listReviews } from "./repo.js";
import { errorResponse } from "../../shared/lib/error-response.js";
import { getProjectRoot } from "../../shared/lib/request.js";
import { getSession, getTriageReview, subscribe } from "../../shared/lib/storage/index.js";
import { zodErrorHandler } from "../../shared/lib/response.js";

const reviewsRouter = new Hono();

const reviewIdParamSchema = z.object({
  id: z.string().uuid(),
});

reviewsRouter.get("/", (c): Response => {
  const reviews = listReviews(getProjectRoot(c));
  return c.json(reviews);
});

reviewsRouter.get("/:id", zValidator("param", reviewIdParamSchema, zodErrorHandler), (c): Response => {
  const { id } = c.req.valid("param");
  const review = getReview(getProjectRoot(c), id);
  if (!review) {
    return errorResponse(c, "Review not found", "REVIEW_NOT_FOUND", 404);
  }
  return c.json({ review });
});

reviewsRouter.delete("/:id", zValidator("param", reviewIdParamSchema, zodErrorHandler), (c): Response => {
  const { id } = c.req.valid("param");
  const deleted = deleteReview(getProjectRoot(c), id);
  return c.json({ deleted });
});

reviewsRouter.get("/:id/stream", zValidator("param", reviewIdParamSchema, zodErrorHandler), (c) => {
  const { id } = c.req.valid("param");
  const session = getSession(id);

  if (!session) {
    return errorResponse(c, "Session not found", ErrorCode.NOT_FOUND, 404);
  }

  const writeEvent = (stream: { writeSSE: (data: { event: string; data: string }) => Promise<void> }, event: { type: string }) =>
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
      const unsubscribe = subscribe(id, async (event) => {
        await writeEvent(stream, event);
        if (event.type === "complete" || event.type === "error") {
          unsubscribe();
          resolve();
        }
      });
    });
  });
});

reviewsRouter.get("/:id/status", zValidator("param", reviewIdParamSchema, zodErrorHandler), async (c) => {
  const { id } = c.req.valid("param");
  const session = getSession(id);
  const savedResult = await getTriageReview(id);

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

export { reviewsRouter };
