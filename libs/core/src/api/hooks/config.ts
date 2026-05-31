import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SettingsConfig, SaveConfigRequest } from "@diffgazer/core/schemas/config";
import { configQueries } from "./queries/config.js";
import { useApi } from "./context.js";

export function useSettings() {
  const api = useApi();
  return useQuery(configQueries.settings(api));
}

export function useInit() {
  const api = useApi();
  return useQuery(configQueries.init(api));
}

export function useConfigCheck() {
  const api = useApi();
  return useQuery(configQueries.check(api));
}

export function useProviderStatus() {
  const api = useApi();
  return useQuery(configQueries.providers(api));
}

export function useOpenRouterModels(options?: { enabled?: boolean }) {
  const api = useApi();
  return useQuery({ ...configQueries.openRouterModels(api), ...options });
}

export function useSaveSettings() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Partial<SettingsConfig>) => api.saveSettings(settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: configQueries.settings(api).queryKey }),
  });
}

export function useSaveConfig() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: SaveConfigRequest) => api.saveConfig(config),
    onSuccess: () => qc.invalidateQueries({ queryKey: configQueries.all() }),
  });
}

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

export function useDeleteProviderCredentials() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (providerId: string) => api.deleteProviderCredentials(providerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: configQueries.all() }),
  });
}
