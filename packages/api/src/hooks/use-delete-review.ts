import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reviewQueries } from "./queries/review.queries.js";
import { useApi } from "./context.js";

export function useDeleteReview() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteReview(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: [...reviewQueries.all(), id] });
      return qc.invalidateQueries({ queryKey: ["reviews"] });
    },
  });
}
