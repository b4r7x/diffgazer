import type { ReviewHistoryMetadata, SavedReview } from "./types.js";
import { deleteReview, getReview, listReviews } from "./repo.js";

export const fetchReviewHistory = (projectRoot: string): ReviewHistoryMetadata[] =>
  listReviews(projectRoot);

export const fetchReviewById = (projectRoot: string, id: string): SavedReview | null =>
  getReview(projectRoot, id);

export const removeReview = (projectRoot: string, id: string): boolean =>
  deleteReview(projectRoot, id);
