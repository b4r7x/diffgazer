import { infiniteQueryOptions, type QueryClient, queryOptions } from "@tanstack/react-query";
import type { ReviewCursor, ReviewMode } from "../../../schemas/review/index.js";
import type { BoundApi } from "../../bound.js";

export const reviewQueries = {
  all: () => ["review"] as const,

  list: (api: BoundApi, projectPath?: string) =>
    infiniteQueryOptions({
      queryKey: [...reviewQueries.all(), "list", projectPath] as const,
      queryFn: ({ pageParam }) => api.getReviews(projectPath, pageParam),
      initialPageParam: undefined as ReviewCursor | undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      staleTime: 0,
    }),

  detail: (api: BoundApi, id: string) =>
    queryOptions({
      queryKey: [...reviewQueries.all(), "detail", id] as const,
      queryFn: () => api.getReview(id),
      staleTime: 60_000,
    }),

  activeSession: (api: BoundApi, mode?: ReviewMode) =>
    queryOptions({
      queryKey: [...reviewQueries.all(), "active-session", mode] as const,
      queryFn: ({ signal }) => api.getActiveReviewSession(mode, signal),
      staleTime: 0,
    }),

  // Key carries no reviewId: the queryFn ignores it, so a reviewId in the key
  // would let a stale refetch relabel the current snapshot as an old review's.
  context: (api: BoundApi) =>
    queryOptions({
      queryKey: [...reviewQueries.all(), "context"] as const,
      queryFn: () => api.getReviewContext(),
      staleTime: 60_000,
    }),
};

export async function refreshReviewContextCache(queryClient: QueryClient, api: BoundApi) {
  const contextQuery = reviewQueries.context(api);

  await queryClient.cancelQueries({ queryKey: contextQuery.queryKey, exact: true });
  await queryClient.invalidateQueries({
    queryKey: contextQuery.queryKey,
    exact: true,
    refetchType: "none",
  });

  return queryClient.fetchQuery({ ...contextQuery, staleTime: 0 });
}
