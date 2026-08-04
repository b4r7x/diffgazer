import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ClientConfigurationAction,
  ClientConfigurationInput,
  ConfigurationId,
  ConfigurationInitResponse,
  ConfigurationRevision,
  ExactModelId,
  SettingsConfig,
  SetupStatus,
} from "../../schemas/config/index.js";
import type { ReadinessAcknowledgement } from "../../schemas/config/readiness.js";
import type { BoundApi } from "../bound.js";
import { useApi } from "./context.js";
import { configQueries, configurationFingerprint } from "./queries/config.js";

type AcceptedAcknowledgement = Extract<ReadinessAcknowledgement, { status: "accepted" }>;

function actionConfigurationId(action: ClientConfigurationAction): ConfigurationId | undefined {
  return "configurationId" in action ? action.configurationId : undefined;
}

export async function invalidateConfigurationCaches(
  queryClient: QueryClient,
  api: BoundApi,
  configurationId?: ConfigurationId,
) {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: configQueries.init(api).queryKey }),
    queryClient.invalidateQueries({ queryKey: configQueries.configurations(api).queryKey }),
  ];

  if (configurationId) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: [...configQueries.all(), "inspect", configurationId],
      }),
      queryClient.invalidateQueries({
        queryKey: [...configQueries.all(), "models", configurationId],
      }),
    );
  } else {
    invalidations.push(
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            key[0] === "config" &&
            (key[1] === "inspect" || key[1] === "models")
          );
        },
      }),
    );
  }

  await Promise.all(invalidations);
}

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

/**
 * Lightweight configured/not-configured gate for CLI surfaces. Derives from the
 * V2 init payload because legacy GET /api/config/check was removed.
 */
export function useConfigCheck() {
  const query = useInit();
  return {
    ...query,
    data: query.data ? { configured: query.data.setup.isConfigured } : undefined,
  };
}

export function useConfigurations() {
  const api = useApi();
  return useQuery(configQueries.configurations(api));
}

export function useConfigurationInspect(configurationId: ConfigurationId | null | undefined) {
  const api = useApi();
  return useQuery({
    ...configQueries.inspect(api, configurationId ?? ""),
    enabled: configurationId != null && configurationId.length > 0,
  });
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

export function useCreateConfiguration() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientConfigurationInput) => api.createConfiguration(input),
    onSuccess: async (response) => {
      await invalidateConfigurationCaches(qc, api, response.configuration?.configurationId);
    },
  });
}

export function useInspectConfiguration() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (configurationId: ConfigurationId) => api.inspectConfiguration(configurationId),
    onSuccess: async (_response, configurationId) => {
      await invalidateConfigurationCaches(qc, api, configurationId);
    },
  });
}

export function useSelectConfiguration() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      configurationId,
      modelId,
    }: {
      configurationId: ConfigurationId;
      modelId: ExactModelId;
    }) => api.selectConfiguration(configurationId, modelId),
    onSuccess: async (_response, { configurationId }) => {
      await invalidateConfigurationCaches(qc, api, configurationId);
    },
  });
}

export function useTestConfiguration() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (configurationId: ConfigurationId) => api.testConfiguration(configurationId),
    onSuccess: async (_response, configurationId) => {
      await invalidateConfigurationCaches(qc, api, configurationId);
    },
  });
}

export function useUpdateConfiguration() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      configurationId,
      expectedRevision,
      input,
      acknowledgement,
    }: {
      configurationId: ConfigurationId;
      expectedRevision: ConfigurationRevision;
      input: ClientConfigurationInput;
      acknowledgement: AcceptedAcknowledgement;
    }) => api.updateConfiguration(configurationId, expectedRevision, input, acknowledgement),
    onSuccess: async (_response, { configurationId }) => {
      await invalidateConfigurationCaches(qc, api, configurationId);
    },
  });
}

export function useDeleteConfiguration() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      configurationId,
      expectedRevision,
    }: {
      configurationId: ConfigurationId;
      expectedRevision: ConfigurationRevision;
    }) => api.deleteConfiguration(configurationId, expectedRevision),
    onSuccess: async (_response, { configurationId }) => {
      await invalidateConfigurationCaches(qc, api, configurationId);
    },
  });
}

export function useConfigurationAction() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: ClientConfigurationAction) => api.executeConfigurationAction(action),
    onSuccess: async (_response, action) => {
      await invalidateConfigurationCaches(qc, api, actionConfigurationId(action));
    },
  });
}

export { configurationFingerprint };
