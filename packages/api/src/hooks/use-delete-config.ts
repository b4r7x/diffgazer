import { useMutation, useQueryClient } from "@tanstack/react-query";
import { configQueries } from "./queries/config.queries.js";
import { useApi } from "./context.js";

export function useDeleteConfig() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteConfig(),
    onSuccess: () => qc.invalidateQueries({ queryKey: configQueries.all() }),
  });
}
