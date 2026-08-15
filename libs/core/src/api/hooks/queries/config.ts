import { queryOptions } from "@tanstack/react-query";
import { CatalogSelectableModelIdSchema } from "../../../catalog/schema.js";
import { configurationFingerprint } from "../../../providers/configuration-fingerprint.js";
import { isModelIdAllowedForProduct } from "../../../providers/product-registry.js";
import type {
  ClientConfigurationSummary,
  ConfigurationModelsResponse,
} from "../../../schemas/config/index.js";
import type { BoundApi } from "../../bound.js";

export const configQueries = {
  all: () => ["config"] as const,

  settings: (api: BoundApi) =>
    queryOptions({
      queryKey: [...configQueries.all(), "settings"] as const,
      queryFn: ({ signal }) => api.getSettings(signal),
      staleTime: 30_000,
    }),

  init: (api: BoundApi) =>
    queryOptions({
      queryKey: [...configQueries.all(), "init"] as const,
      queryFn: ({ signal }) => api.loadConfigurationInit(signal),
      staleTime: 5 * 60_000,
    }),

  configurations: (api: BoundApi) =>
    queryOptions({
      queryKey: [...configQueries.all(), "configurations"] as const,
      queryFn: ({ signal }) => api.listConfigurations(signal),
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
  productId: ClientConfigurationSummary["productId"],
): boolean {
  return (
    CatalogSelectableModelIdSchema.safeParse(modelId).success &&
    isModelIdAllowedForProduct(productId, modelId)
  );
}

export function configurationModelsQuery(api: BoundApi, configuration: ClientConfigurationSummary) {
  return queryOptions({
    queryKey: [
      ...configQueries.all(),
      "models",
      configuration.configurationId,
      configurationFingerprint(configuration),
    ] as const,
    queryFn: async ({ signal }): Promise<ConfigurationModelsResponse> => {
      const response = await api.getConfigurationModels(configuration.configurationId, signal);
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
