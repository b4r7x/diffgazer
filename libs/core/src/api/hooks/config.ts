import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ClientConfigurationAction,
  ClientConfigurationInput,
  ConfigurationId,
  ConfigurationRevision,
  ExactModelId,
  SettingsConfig,
} from "../../schemas/config/index.js";
import type { ReadinessAcknowledgement } from "../../schemas/config/readiness.js";
import type { HostedApiEndpoint } from "../../schemas/config/transports.js";
import type { BoundApi } from "../bound.js";
import { useApi } from "./context.js";
import { configQueries } from "./queries/config.js";

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
        queryKey: [...configQueries.all(), "models", configurationId],
      }),
    );
  } else {
    invalidations.push(
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === "config" && key[1] === "models";
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

export function useConfigurations() {
  const api = useApi();
  return useQuery(configQueries.configurations(api));
}

export function useSaveSettings() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Partial<SettingsConfig>) => api.saveSettings(settings),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: configQueries.settings(api).queryKey }),
        qc.invalidateQueries({ queryKey: configQueries.init(api).queryKey }),
      ]),
  });
}

export function useCreateConfiguration() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (request: {
      input: ClientConfigurationInput;
      acknowledgement?: AcceptedAcknowledgement;
    }) => api.createConfiguration(request),
    onSuccess: (response) =>
      invalidateConfigurationCaches(qc, api, response.configuration?.configurationId),
  });
}

export function useInspectConfiguration() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (configurationId: ConfigurationId) => api.inspectConfiguration(configurationId),
    onSuccess: (_response, configurationId) =>
      invalidateConfigurationCaches(qc, api, configurationId),
  });
}

export function useSelectConfiguration() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      configurationId,
      modelId,
      endpoint,
    }: {
      configurationId: ConfigurationId;
      modelId: ExactModelId;
      endpoint?: HostedApiEndpoint;
    }) => api.selectConfiguration(configurationId, modelId, endpoint),
    onSuccess: (_response, { configurationId }) =>
      invalidateConfigurationCaches(qc, api, configurationId),
  });
}

export function useTestConfiguration() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (configurationId: ConfigurationId) => api.testConfiguration(configurationId),
    onSuccess: (_response, configurationId) =>
      invalidateConfigurationCaches(qc, api, configurationId),
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
    onSuccess: (_response, { configurationId }) =>
      invalidateConfigurationCaches(qc, api, configurationId),
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
      expectedRevision?: ConfigurationRevision;
    }) => api.deleteConfiguration(configurationId, expectedRevision),
    onSuccess: (_response, { configurationId }) =>
      invalidateConfigurationCaches(qc, api, configurationId),
  });
}

export function useConfigurationAction() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: ClientConfigurationAction) => api.executeConfigurationAction(action),
    onSuccess: (_response, action) =>
      invalidateConfigurationCaches(qc, api, actionConfigurationId(action)),
  });
}
