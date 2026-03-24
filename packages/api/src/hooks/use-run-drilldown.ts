import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reviewQueries } from "./queries/review.queries.js";
import { useApi } from "./context.js";

export function useRunDrilldown() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, issueId }: { reviewId: string; issueId: string }) =>
      api.runReviewDrilldown(reviewId, issueId),
    onSuccess: (_data, { reviewId }) =>
      qc.invalidateQueries({ queryKey: [...reviewQueries.all(), reviewId] }),
  });
}
