import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ClientConfigurationAction,
  ConfigurationInitResponse,
  SettingsConfig,
  SetupStatus,
} from "../../schemas/config/index.js";
import { useApi } from "./context.js";
import { configQueries } from "./queries/config.js";

export function useSettings() {
  const api = useApi();
  return useQuery(configQueries.settings(api));
}

export function useConfigurationInit() {
  const api = useApi();
  return useQuery(configQueries.init(api));
}

function projectSetupStatus(init: ConfigurationInitResponse): SetupStatus {
  const selectedConfiguration = init.configurations.find(
    ({ configuration }) => configuration.configurationId === init.selectedConfigurationId,
  );
  const hasProvider = selectedConfiguration !== undefined;
  const hasModel = selectedConfiguration?.configuration.selectedModelId != null;
  const hasTrust = init.project.trust !== null;
  const hasSecretsStorage = init.settings.secretsStorage !== null;
  const isConfigured = hasProvider;
  const isReady = selectedConfiguration?.readiness.status === "ready";
  const missing: string[] = [];

  if (!hasProvider) missing.push("provider");
  if (!hasModel) missing.push("model");
  if (!hasTrust) missing.push("trust");
  if (!hasSecretsStorage) missing.push("secrets storage");

  return {
    hasSecretsStorage,
    hasProvider,
    hasModel,
    hasTrust,
    isConfigured,
    isReady,
    missing,
  };
}

/**
 * Internal compatibility adapter for the restored diagnostics hook. New
 * callers use useConfigurationInit and consume the V2 response directly.
 */
type ConfigurationInitWithSetup = ConfigurationInitResponse & { readonly setup: SetupStatus };
type ConfigurationInitQuery = Omit<ReturnType<typeof useConfigurationInit>, "data"> & {
  data: ConfigurationInitWithSetup | undefined;
};

export function useInit(): ConfigurationInitQuery {
  const query = useConfigurationInit();
  return {
    ...query,
    data: query.data
      ? {
          ...query.data,
          setup: projectSetupStatus(query.data),
        }
      : query.data,
  };
}

export function useConfigurations() {
  const api = useApi();
  return useQuery(configQueries.configurations(api));
}

export function useSaveSettings() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Partial<SettingsConfig>) => api.saveSettings(settings),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: configQueries.settings(api).queryKey }),
        qc.invalidateQueries({ queryKey: configQueries.init(api).queryKey }),
      ]);
    },
  });
}

export function useConfigurationAction() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: ClientConfigurationAction) => api.executeConfigurationAction(action),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: configQueries.all() });
    },
  });
}
