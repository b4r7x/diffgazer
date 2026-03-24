import { useMutation, useQueryClient } from "@tanstack/react-query";
import { configQueries } from "./queries/config.queries.js";
import { useApi } from "./context.js";

export function useDeleteProviderCredentials() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (providerId: string) => api.deleteProviderCredentials(providerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: configQueries.all() }),
  });
}
