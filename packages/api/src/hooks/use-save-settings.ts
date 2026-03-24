import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SettingsConfig } from "@diffgazer/schemas/config";
import { configQueries } from "./queries/config.queries.js";
import { useApi } from "./context.js";

export function useSaveSettings() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Partial<SettingsConfig>) => api.saveSettings(settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: configQueries.settings(api).queryKey }),
  });
}
