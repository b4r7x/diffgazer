import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reviewQueries } from "./queries/review.queries.js";
import { useApi } from "./context.js";

export function useRefreshReviewContext() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (options?: { force?: boolean }) => api.refreshReviewContext(options),
    onSuccess: () => qc.invalidateQueries({ queryKey: reviewQueries.context(api).queryKey }),
  });
}
