import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { fetchReviewById, fetchReviewHistory, removeReview } from "./service.js";
import { getProjectRoot } from "../../shared/lib/request.js";

const reviewsRouter = new Hono();

const reviewIdParamSchema = z.object({
  id: z.string().min(1),
});

reviewsRouter.get("/", (c): Response => {
  const reviews = fetchReviewHistory(getProjectRoot(c));
  return c.json(reviews);
});

reviewsRouter.get("/:id", zValidator("param", reviewIdParamSchema), (c): Response => {
  const { id } = c.req.valid("param");
  const review = fetchReviewById(getProjectRoot(c), id);
  if (!review) {
    return c.json({ error: { message: "Review not found", code: "REVIEW_NOT_FOUND" } }, 404);
  }
  return c.json({ review });
});

reviewsRouter.delete("/:id", zValidator("param", reviewIdParamSchema), (c): Response => {
  const { id } = c.req.valid("param");
  const deleted = removeReview(getProjectRoot(c), id);
  return c.json({ deleted });
});

export { reviewsRouter };
