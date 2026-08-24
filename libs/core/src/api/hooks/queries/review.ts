import {
  infiniteQueryOptions,
  type QueryClient,
  queryOptions,
  skipToken,
} from "@tanstack/react-query";
import type {
  CreateReviewOutcome,
  ReviewCursor,
  ReviewMode,
} from "../../../schemas/review/index.js";
import type { BoundApi } from "../../bound.js";

export const reviewQueries = {
  all: () => ["review"] as const,

  // A refetch of an infinite query replays every retained cursor page, so the
  // work grows with how far the user has paged. Entering history (mount) and the
  // explicit refresh actions still refetch; regaining window focus does not,
  // because nobody asked for it and the replay is linear in retained pages.
  list: (api: BoundApi) =>
    infiniteQueryOptions({
      queryKey: [...reviewQueries.all(), "list"] as const,
      queryFn: ({ pageParam, signal }) => api.getReviews(pageParam, signal),
      initialPageParam: undefined as ReviewCursor | undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      staleTime: 0,
      refetchOnWindowFocus: false,
    }),

  detail: (api: BoundApi, id: string | null) =>
    queryOptions({
      queryKey: [...reviewQueries.all(), "detail", id] as const,
      queryFn: id === null ? skipToken : ({ signal }) => api.getReview(id, signal),
      staleTime: 60_000,
    }),

  activeSession: (api: BoundApi, mode?: ReviewMode) =>
    queryOptions({
      queryKey: [...reviewQueries.all(), "active-session", mode] as const,
      queryFn: ({ signal }) => api.getActiveReviewSession(mode, signal),
      staleTime: 0,
    }),

  // Client-authored and never fetched: what the create response reported about
  // the run it opened, recorded so the review screen that the create opens
  // renders the outcome the server already decided rather than waiting for the
  // stream to replay it.
  createOutcome: (reviewId: string | undefined) =>
    queryOptions<CreateReviewOutcome>({
      queryKey: [...reviewQueries.all(), "create-outcome", reviewId] as const,
      queryFn: skipToken,
    }),

  // Key carries no reviewId: the queryFn ignores it, so a reviewId in the key
  // would let a stale refetch relabel the current snapshot as an old review's.
  context: (api: BoundApi) =>
    queryOptions({
      queryKey: [...reviewQueries.all(), "context"] as const,
      queryFn: ({ signal }) => api.getReviewContext(signal),
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
