import { queryOptions } from "@tanstack/react-query";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
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
      queryKey: [...reviewQueries.all(), id] as const,
      queryFn: () => api.getReview(id),
      staleTime: 60_000,
    }),

  activeSession: (api: BoundApi, mode?: ReviewMode) =>
    queryOptions({
      queryKey: [...reviewQueries.all(), "active-session", mode] as const,
      queryFn: () => api.getActiveReviewSession(mode),
      staleTime: 0,
    }),

  context: (api: BoundApi) =>
    queryOptions({
      queryKey: [...reviewQueries.all(), "context"] as const,
      queryFn: () => api.getReviewContext(),
      staleTime: 60_000,
    }),
};
