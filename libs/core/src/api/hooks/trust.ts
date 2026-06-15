import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SaveTrustRequest } from "../../schemas/config/index.js";
import { useApi } from "./context.js";
import { configQueries } from "./queries/config.js";
import { reviewQueries } from "./queries/review.js";

export function useSaveTrust() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trust: SaveTrustRequest) => api.saveTrust(trust),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: configQueries.init(api).queryKey }),
        qc.invalidateQueries({ queryKey: reviewQueries.all() }),
      ]);
    },
  });
}

export function useDeleteTrust() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteTrust(),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: configQueries.init(api).queryKey }),
        qc.invalidateQueries({ queryKey: reviewQueries.all() }),
      ]);
    },
  });
}
