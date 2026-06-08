import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReviewMode } from "../../schemas/review/index.js";
import { useApi } from "./context.js";
import { reviewQueries } from "./queries/review.js";

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

export function useReviewContext(options?: { enabled?: boolean; reviewId?: string | null }) {
  const api = useApi();
  const { reviewId, ...queryOptionsOverrides } = options ?? {};
  return useQuery({ ...reviewQueries.context(api, reviewId), ...queryOptionsOverrides });
}

export function useDeleteReview() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteReview(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: reviewQueries.detail(api, id).queryKey });
      return qc.invalidateQueries({ queryKey: reviewQueries.all() });
    },
  });
}

export function useRefreshReviewContext() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (options?: { force?: boolean }) => api.refreshReviewContext(options),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: reviewQueries.context(api).queryKey,
      }),
  });
}

export function useCreateReview() {
  const api = useApi();
  return useMutation({
    mutationFn: (options: Parameters<typeof api.createReview>[0]) => api.createReview(options),
  });
}
