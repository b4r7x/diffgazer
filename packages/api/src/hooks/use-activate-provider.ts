import { useMutation, useQueryClient } from "@tanstack/react-query";
import { configQueries } from "./queries/config.queries.js";
import { useApi } from "./context.js";

export function useActivateProvider() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ providerId, model }: { providerId: string; model?: string }) =>
      api.activateProvider(providerId, model),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: configQueries.providers(api).queryKey }),
        qc.invalidateQueries({ queryKey: configQueries.init(api).queryKey }),
      ]);
    },
  });
}
