import { queryOptions } from "@tanstack/react-query";
import type { ReviewMode } from "../../../schemas/review/index.js";
import type { BoundApi } from "../../bound.js";

export const reviewQueries = {
  all: () => ["review"] as const,

  list: (api: BoundApi, projectPath?: string) =>
    queryOptions({
      queryKey: [...reviewQueries.all(), "list", projectPath] as const,
      queryFn: () => api.getReviews(projectPath),
      staleTime: 0,
    }),

  detail: (api: BoundApi, id: string) =>
    queryOptions({
      // "detail" discriminator keeps per-review entries from colliding with the
      // sibling literal keys ("list", "active-session", "context").
      queryKey: [...reviewQueries.all(), "detail", id] as const,
      queryFn: () => api.getReview(id),
      staleTime: 60_000,
    }),

  activeSession: (api: BoundApi, mode?: ReviewMode) =>
    queryOptions({
      queryKey: [...reviewQueries.all(), "active-session", mode] as const,
      queryFn: () => api.getActiveReviewSession(mode),
      staleTime: 0,
    }),

  // The server returns the CURRENT workspace context snapshot; there is no
  // per-review context route, so the key carries no reviewId. Partitioning by a
  // reviewId the queryFn ignores would let a stale refetch relabel today's
  // snapshot as an old review's.
  context: (api: BoundApi) =>
    queryOptions({
      queryKey: [...reviewQueries.all(), "context"] as const,
      queryFn: () => api.getReviewContext(),
      staleTime: 60_000,
    }),
};
