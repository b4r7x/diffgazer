import { PROVIDER_OVERLAY } from "@diffgazer/core/catalog";
import {
  CATALOG_EMPTY_MODELS_REASON,
  LIVE_LIST_NO_ADMITTED_MODELS_REASON,
  LIVE_LIST_UNAVAILABLE_REASON,
} from "@diffgazer/core/providers";
import type {
  ConfigurationId,
  ModelInfo,
  ProviderModelsResponse,
  RunnableProductId,
} from "@diffgazer/core/schemas/config";
import { type LiveModelList, resolveLiveModelList } from "../live-model-lists.js";
import { isOffline } from "./fetch.js";
import { providerModelsFromTier } from "./models.js";
import {
  beginPoolMembership,
  type PoolMembershipRequest,
  resolvePoolMembership,
} from "./pool-membership.js";
import { resolveCatalogTier } from "./tiers.js";

export interface CatalogDiscoveryTuple {
  readonly configurationId: ConfigurationId;
  readonly productId: RunnableProductId;
  /**
   * The configuration's bound endpoint: it keys the live-list cache and names
   * the pool rows are labelled against. The response is the union of both
   * pools, so a row may be servable only from the sibling.
   */
  readonly endpoint: string;
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

const emptyDiscoveryReason = async (
  productId: RunnableProductId,
  liveList: Promise<LiveModelList | null> | null,
): Promise<string> => {
  if (PROVIDER_OVERLAY[productId] !== undefined) return CATALOG_EMPTY_MODELS_REASON;
  return (await liveList) === null
    ? LIVE_LIST_UNAVAILABLE_REASON
    : LIVE_LIST_NO_ADMITTED_MODELS_REASON;
};

/**
 * Shared reader so discovery and picker paths stay aligned; tests may spy on
 * `.get`. The live list is awaited alongside the catalog tier: the two requests
 * are independent, so a cold open pays the slower of them, not the sum. The
 * sibling pool's list, when there is one, is already in flight beside them, so
 * it too is paid for in parallel rather than after.
 */
export const catalogProviderModels = {
  get: async (
    productId: RunnableProductId,
    liveList: Promise<LiveModelList | null> | null = null,
    pool: PoolMembershipRequest | null = null,
  ): Promise<ProviderModelsResponse> => {
    const [tier, list] = await Promise.all([resolveCatalogTier(productId), liveList]);
    const membership = pool ? await resolvePoolMembership(pool, tier.catalog) : null;
    return providerModelsFromTier(tier, productId, list, membership);
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

  const offline = isOffline();
  const liveList = offline ? null : resolveLiveModelList(tuple);
  const response = await catalogProviderModels.get(
    tuple.productId,
    liveList,
    beginPoolMembership(tuple, { offline }),
  );
  if (response.models.length === 0)
    return skipped(await emptyDiscoveryReason(tuple.productId, liveList));
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
