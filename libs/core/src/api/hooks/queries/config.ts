import { queryOptions } from "@tanstack/react-query";
import type {
  ClientConfigurationActionResponse,
  ClientConfigurationSummary,
  ConfigurationId,
} from "../../../schemas/config/index.js";
import type { Readiness } from "../../../schemas/config/readiness.js";
import type { BoundApi } from "../../bound.js";

type SupportedConfigurationSummary = Extract<ClientConfigurationSummary, { status: "supported" }>;

function noticeFingerprint(notices: ClientConfigurationSummary["notices"]) {
  return notices.map((notice) => [notice.id, notice.noticeVersion]);
}

function configurationFingerprintInput(configuration: ClientConfigurationSummary) {
  const base = {
    configurationId: configuration.configurationId,
    revision: configuration.revision,
    status: configuration.status,
    productId: configuration.productId,
    transportFamily: configuration.transportFamily,
    selectedModelId: configuration.selectedModelId,
    notices: noticeFingerprint(configuration.notices),
    availableActions: configuration.availableActions,
  };

  if (configuration.status === "removed") {
    return base;
  }

  if (configuration.transportFamily === "hosted-api") {
    return {
      ...base,
      endpoint: configuration.endpoint,
      region: configuration.region ?? null,
      workspace: configuration.workspace ?? null,
    };
  }

  if (configuration.transportFamily === "local-http") {
    return {
      ...base,
      endpoint: configuration.endpoint,
      authentication: configuration.authentication,
      presetId: configuration.presetId ?? null,
    };
  }

  return {
    ...base,
    installationId: configuration.installationId,
  };
}

export function configurationFingerprint(configuration: ClientConfigurationSummary): string {
  return JSON.stringify(configurationFingerprintInput(configuration));
}

export type ConfigurationFingerprint = string;

export const configQueries = {
  all: () => ["config"] as const,

  settings: (api: BoundApi) =>
    queryOptions({
      queryKey: [...configQueries.all(), "settings"] as const,
      queryFn: () => api.getSettings(),
      staleTime: 30_000,
    }),

  init: (api: BoundApi) =>
    queryOptions({
      queryKey: [...configQueries.all(), "init"] as const,
      queryFn: () => api.loadConfigurationInit(),
      staleTime: 5 * 60_000,
    }),

  configurations: (api: BoundApi) =>
    queryOptions({
      queryKey: [...configQueries.all(), "configurations"] as const,
      queryFn: () => api.listConfigurations(),
      staleTime: 30_000,
    }),

  inspect: (api: BoundApi, configurationId: ConfigurationId) =>
    queryOptions({
      queryKey: [...configQueries.all(), "inspect", configurationId] as const,
      queryFn: () => api.inspectConfiguration(configurationId),
      staleTime: 30_000,
    }),
};

type ConfigurationDiscoveryQueryOptions = {
  queryKey: readonly unknown[];
  queryFn: () => Promise<ClientConfigurationActionResponse>;
  staleTime: number;
};

type ConfigurationReadinessQueryOptions = {
  queryKey: readonly unknown[];
  queryFn: () => Promise<Readiness | null>;
  staleTime: number;
};

export function configurationDiscoveryQuery(
  api: BoundApi,
  configuration: SupportedConfigurationSummary,
  fingerprint: ConfigurationFingerprint = configurationFingerprint(configuration),
): ConfigurationDiscoveryQueryOptions {
  return {
    queryKey: [...configQueries.all(), "discovery", configuration.configurationId, fingerprint],
    queryFn: (): Promise<ClientConfigurationActionResponse> =>
      api.testConfiguration(configuration.configurationId),
    staleTime: 5 * 60_000,
  };
}

export function configurationReadinessQuery(
  api: BoundApi,
  configuration: SupportedConfigurationSummary,
  fingerprint: ConfigurationFingerprint = configurationFingerprint(configuration),
): ConfigurationReadinessQueryOptions {
  return {
    queryKey: [...configQueries.all(), "readiness", configuration.configurationId, fingerprint],
    queryFn: async (): Promise<Readiness | null> => {
      const response = await api.testConfiguration(configuration.configurationId);
      return response.readiness ?? null;
    },
    staleTime: 5 * 60_000,
  };
}

configQueries satisfies {
  all: () => readonly ["config"];
  settings: (api: BoundApi) => unknown;
  init: (api: BoundApi) => unknown;
  configurations: (api: BoundApi) => unknown;
  inspect: (api: BoundApi, configurationId: ConfigurationId) => unknown;
};
