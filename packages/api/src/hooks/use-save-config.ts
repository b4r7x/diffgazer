import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SaveConfigRequest } from "@diffgazer/schemas/config";
import { configQueries } from "./queries/config.queries.js";
import { useApi } from "./context.js";

export function useSaveConfig() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: SaveConfigRequest) => api.saveConfig(config),
    onSuccess: () => qc.invalidateQueries({ queryKey: configQueries.all() }),
  });
}
