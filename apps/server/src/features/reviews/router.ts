import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { deleteReview, getReview, listReviews } from "./repo.js";
import { errorResponse } from "../../shared/lib/error-response.js";
import { getProjectRoot } from "../../shared/lib/request.js";

const reviewsRouter = new Hono();

const reviewIdParamSchema = z.object({
  id: z.string().min(1),
});

reviewsRouter.get("/", (c): Response => {
  const reviews = listReviews(getProjectRoot(c));
  return c.json(reviews);
});

reviewsRouter.get("/:id", zValidator("param", reviewIdParamSchema), (c): Response => {
  const { id } = c.req.valid("param");
  const review = getReview(getProjectRoot(c), id);
  if (!review) {
    return errorResponse(c, "Review not found", "REVIEW_NOT_FOUND", 404);
  }
  return c.json({ review });
});

reviewsRouter.delete("/:id", zValidator("param", reviewIdParamSchema), (c): Response => {
  const { id } = c.req.valid("param");
  const deleted = deleteReview(getProjectRoot(c), id);
  return c.json({ deleted });
});

export { reviewsRouter };
