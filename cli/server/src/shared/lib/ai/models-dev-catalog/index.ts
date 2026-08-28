import { CATALOG_EMPTY_MODELS_REASON } from "@diffgazer/core/providers";
import type {
  ConfigurationId,
  ModelInfo,
  ProviderModelsResponse,
  RunnableProductId,
} from "@diffgazer/core/schemas/config";
import { type LiveModelList, resolveLiveModelList } from "../live-model-lists.js";
import { isOffline } from "./fetch.js";
import { providerModelsFromTier } from "./models.js";
import { resolveCatalogTier } from "./tiers.js";

export interface CatalogDiscoveryTuple {
  readonly configurationId: ConfigurationId;
  readonly productId: RunnableProductId;
}

export type ConfigurationCatalogDiscovery =
  | (CatalogDiscoveryTuple & {
      readonly status: "passed";
      readonly models: ModelInfo[];
      readonly fetchedAt: string;
      readonly source: ProviderModelsResponse["source"];
      readonly cached: boolean;
      readonly checkedAt: string;
    })
  | (CatalogDiscoveryTuple & {
      readonly status: "skipped";
      readonly models: [];
      readonly reason: string;
      readonly checkedAt: string;
    });

/**
 * Shared reader so discovery and picker paths stay aligned; tests may spy on
 * `.get`. The live list is awaited alongside the catalog tier: the two requests
 * are independent, so a cold open pays the slower of them, not the sum.
 */
export const catalogProviderModels = {
  get: async (
    productId: RunnableProductId,
    liveList: Promise<LiveModelList | null> | null = null,
  ): Promise<ProviderModelsResponse> => {
    const [tier, list] = await Promise.all([resolveCatalogTier(productId), liveList]);
    return providerModelsFromTier(tier, productId, list);
  },
};

export const discoverConfigurationCatalog = async (
  tuple: CatalogDiscoveryTuple,
): Promise<ConfigurationCatalogDiscovery> => {
  const checkedAt = new Date().toISOString();
  const skipped = (reason: string): ConfigurationCatalogDiscovery => ({
    ...tuple,
    status: "skipped",
    models: [],
    reason,
    checkedAt,
  });

  const response = await catalogProviderModels.get(
    tuple.productId,
    isOffline() ? null : resolveLiveModelList(tuple),
  );
  if (response.models.length === 0) return skipped(CATALOG_EMPTY_MODELS_REASON);
  return {
    ...tuple,
    status: "passed",
    models: response.models,
    fetchedAt: response.fetchedAt,
    source: response.source,
    cached: response.cached,
    checkedAt: response.fetchedAt,
  };
};
