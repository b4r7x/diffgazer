import { Hono } from "hono";
import {
  listReviews,
  readReview,
  deleteReview,
} from "@repo/core/storage";
import { handleStoreError, successResponse } from "../../lib/response.js";
import { requireUuidParam, validateProjectPath } from "../../lib/validation.js";

export const reviews = new Hono();

reviews.get("/", async (c) => {
  const projectPath = validateProjectPath(c.req.query("projectPath"));
  const result = await listReviews(projectPath);

  if (!result.ok) return handleStoreError(c, result.error);

  return successResponse(c, {
    reviews: result.value.items,
    warnings: result.value.warnings.length > 0 ? result.value.warnings : undefined,
  });
});

reviews.get("/:id", async (c) => {
  const reviewId = requireUuidParam(c, "id");
  const result = await readReview(reviewId);

  if (!result.ok) return handleStoreError(c, result.error);

  return successResponse(c, { review: result.value });
});

reviews.delete("/:id", async (c) => {
  const reviewId = requireUuidParam(c, "id");
  const result = await deleteReview(reviewId);

  if (!result.ok) return handleStoreError(c, result.error);

  return successResponse(c, { deleted: true });
});
