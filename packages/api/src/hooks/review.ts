import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReviewMode } from "@diffgazer/schemas/review";
import { reviewQueries } from "./queries/review.js";
import { useApi } from "./context.js";

export function useReviews(projectPath?: string) {
  const api = useApi();
  return useQuery(reviewQueries.list(api, projectPath));
}

export function useReview(id: string) {
  const api = useApi();
  return useQuery({ ...reviewQueries.detail(api, id), enabled: !!id });
}

export function useActiveReviewSession(mode?: ReviewMode) {
  const api = useApi();
  return useQuery(reviewQueries.activeSession(api, mode));
}

export function useReviewContext() {
  const api = useApi();
  return useQuery(reviewQueries.context(api));
}

export function useDeleteReview() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteReview(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: [...reviewQueries.all(), id] });
      return qc.invalidateQueries({ queryKey: reviewQueries.all() });
    },
  });
}

export function useRefreshReviewContext() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (options?: { force?: boolean }) =>
      api.refreshReviewContext(options),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: reviewQueries.context(api).queryKey,
      }),
  });
}
