import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TrustConfig } from "@diffgazer/schemas/config";
import { trustQueries } from "./queries/trust.queries.js";
import { configQueries } from "./queries/config.queries.js";
import { useApi } from "./context.js";

export function useSaveTrust() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trust: TrustConfig) => api.saveTrust(trust),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: trustQueries.all() }),
        qc.invalidateQueries({ queryKey: configQueries.init(api).queryKey }),
      ]);
    },
  });
}
