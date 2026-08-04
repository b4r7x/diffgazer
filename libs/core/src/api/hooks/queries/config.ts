import { queryOptions } from "@tanstack/react-query";
import { CatalogSelectableModelIdSchema } from "../../../catalog/schema.js";
import { isModelIdAllowedForProduct } from "../../../providers/product-registry.js";
import type {
  ClientConfigurationSummary,
  ConfigurationId,
  ConfigurationModelsResponse,
} from "../../../schemas/config/index.js";
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

/**
 * Sole owner of model-row admissibility on the client: a wire response may only
 * cache rows whose id is an exact, non-alias catalog id the product allows.
 * `CatalogSelectableModelIdSchema` refines `ExactModelIdSchema`, so one parse
 * covers both rules.
 */
function isSelectableModelForProduct(
  modelId: string,
  productId: SupportedConfigurationSummary["productId"],
): boolean {
  return (
    CatalogSelectableModelIdSchema.safeParse(modelId).success &&
    isModelIdAllowedForProduct(productId, modelId)
  );
}

export function configurationModelsQuery(
  api: BoundApi,
  configuration: SupportedConfigurationSummary,
  fingerprint: ConfigurationFingerprint = configurationFingerprint(configuration),
) {
  return queryOptions({
    queryKey: [
      ...configQueries.all(),
      "models",
      configuration.configurationId,
      fingerprint,
    ] as const,
    queryFn: async (): Promise<ConfigurationModelsResponse> => {
      const response = await api.getConfigurationModels(configuration.configurationId);
      if (response.status !== "passed") return response;
      return {
        ...response,
        models: response.models.filter((model) =>
          isSelectableModelForProduct(model.id, configuration.productId),
        ),
      };
    },
    staleTime: 5 * 60_000,
  });
}
