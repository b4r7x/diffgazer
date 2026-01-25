import { Hono } from "hono";
import {
  reviewStore,
  listReviews,
} from "@repo/core/storage";
import { handleStoreError } from "../../lib/response.js";
import { requireUuidParam, validateProjectPath } from "../../lib/validation.js";

export const reviews = new Hono();

reviews.get("/", async (c) => {
  const projectPath = validateProjectPath(c.req.query("projectPath"));
  const result = await listReviews(projectPath);

  if (!result.ok) return handleStoreError(c, result.error);

  return c.json({
    reviews: result.value.items,
    warnings: result.value.warnings.length > 0 ? result.value.warnings : undefined,
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
