import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TrustConfig } from "../../schemas/config/index.js";
import { useApi } from "./context.js";
import { configQueries } from "./queries/config.js";
import { reviewQueries } from "./queries/review.js";
import { trustQueries } from "./queries/trust.js";

export function useSaveTrust() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trust: TrustConfig) => api.saveTrust(trust),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: trustQueries.all() }),
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
    mutationFn: (projectId: string) => api.deleteTrust(projectId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: trustQueries.all() }),
        qc.invalidateQueries({ queryKey: configQueries.init(api).queryKey }),
      ]);
    },
  });
}
