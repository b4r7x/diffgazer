import { CATALOG_SNAPSHOT, type ModelsDevCatalog } from "@diffgazer/core/catalog";
import { getErrorMessage } from "@diffgazer/core/errors";
import type { Result } from "@diffgazer/core/result";
import type { RunnableProductId } from "@diffgazer/core/schemas/config";
import { quarantineCorruptFile } from "../../fs.js";
import { log } from "../../log.js";
import { getGlobalModelsDevCatalogPath } from "../../paths.js";
import { isEntryFresh } from "../disk-cache.js";
import {
  countModels,
  loadCacheStateMemoized,
  type ModelsDevCatalogCache,
  persistIfNotDroppingProviders,
} from "./cache.js";
import { fetchModelsDevCatalog, isOffline, type ModelsDevFetch } from "./fetch.js";
import {
  type CatalogTier,
  type CatalogTierSource,
  modelInfoFromBoundedObservation,
  observationSourceForResult,
} from "./models.js";

const CACHE_TTL_MS = 60 * 60 * 1000;
interface CatalogFetchGeneration {
  result: Result<ModelsDevFetch, { message: string }>;
  fetchedAt: string;
}

interface CatalogFlight {
  requestedProducts: Set<RunnableProductId>;
  promise: Promise<CatalogFetchGeneration>;
}

const catalogFlights = new Map<string, CatalogFlight>();

// Returns null when the catalog yields no models for the product so the caller
// falls through to the next tier instead of serving a blank picker.
const tierIfNonEmpty = (
  catalog: ModelsDevCatalog,
  productId: RunnableProductId,
  fetchedAt: string,
  source: CatalogTierSource,
): CatalogTier | null => {
  const models = modelInfoFromBoundedObservation(
    catalog,
    productId,
    observationSourceForResult(source),
    fetchedAt,
  );
  return models.length === 0 ? null : { catalog, fetchedAt, source };
};

const snapshotTier = (): CatalogTier => ({
  catalog: CATALOG_SNAPSHOT,
  fetchedAt: new Date().toISOString(),
  source: "snapshot",
});

const resolveCatalogGeneration = async (options: {
  key: string;
  path: string;
  productId: RunnableProductId;
  baselineModelCount: number;
  trustedCache: ModelsDevCatalogCache | null;
}): Promise<CatalogFetchGeneration> => {
  const active = catalogFlights.get(options.key);
  if (active) {
    active.requestedProducts.add(options.productId);
    return active.promise;
  }

  const requestedProducts = new Set<RunnableProductId>([options.productId]);
  const trustedCache = options.trustedCache;
  const promise = (async (): Promise<CatalogFetchGeneration> => {
    const result = await fetchModelsDevCatalog({
      baselineModelCount: options.baselineModelCount,
      ...(trustedCache?.etag === undefined
        ? {}
        : { revalidate: { etag: trustedCache.etag, catalog: trustedCache.catalog } }),
    });
    const fetchedAt = new Date().toISOString();
    if (result.ok) {
      const { catalog, etag, revalidated } = result.value;
      const servesRequestedProduct = (): boolean =>
        [...requestedProducts].some(
          (productId) => tierIfNonEmpty(catalog, productId, fetchedAt, "live") !== null,
        );
      if (revalidated || servesRequestedProduct()) {
        persistIfNotDroppingProviders(options.path, { catalog, fetchedAt, etag }, trustedCache);
      }
    }

    return { result, fetchedAt };
  })();
  const flight = { requestedProducts, promise };
  catalogFlights.set(options.key, flight);

  try {
    return await promise;
  } finally {
    if (catalogFlights.get(options.key) === flight) catalogFlights.delete(options.key);
  }
};

export const resolveCatalogTier = async (productId: RunnableProductId): Promise<CatalogTier> => {
  const path = getGlobalModelsDevCatalogPath();
  const loadedCache = loadCacheStateMemoized(path);
  const cacheState = loadedCache.state;

  // A present-but-unloadable cache must not be mistaken for a baseline-free first
  // run: quarantine it so the next fetch is still shrink-guarded against the snapshot floor.
  if (cacheState.status === "corrupt") {
    try {
      const backupPath = quarantineCorruptFile(path);
      log("warn", "models_dev_catalog_quarantined", { backupPath });
    } catch (error) {
      log("warn", "models_dev_catalog_quarantine_failed", { error: getErrorMessage(error) });
    }
  }
  const cache = cacheState.status === "ok" ? cacheState.entry : null;

  if (cache && isEntryFresh(cache, CACHE_TTL_MS)) {
    const fresh = tierIfNonEmpty(cache.catalog, productId, cache.fetchedAt, "cache");
    if (fresh) return fresh;
  }

  if (isOffline()) {
    if (cache) {
      // A cache served here is stale-beyond-TTL (the fresh tier above already returned
      // for a fresh hit); fetchedAt carries the honest staleness signal.
      const stale = tierIfNonEmpty(cache.catalog, productId, cache.fetchedAt, "cache");
      if (stale) {
        log("info", "models_dev_catalog_offline_stale_serve", {
          fetchedAt: cache.fetchedAt,
          productId,
        });
        return stale;
      }
    }
    return snapshotTier();
  }

  // Shrink-guard baseline: the trusted cache, or the snapshot count when a corrupt
  // cache left us none, rather than fetching with no shrink protection.
  let baselineModelCount = 0;
  if (cache) {
    baselineModelCount = countModels(cache.catalog);
  } else if (cacheState.status === "corrupt") {
    baselineModelCount = countModels(CATALOG_SNAPSHOT);
  }
  const generation = await resolveCatalogGeneration({
    key: JSON.stringify([path, loadedCache.identity]),
    path,
    productId,
    baselineModelCount,
    trustedCache: cache,
  });

  if (generation.result.ok) {
    const { catalog: fetched, revalidated } = generation.result.value;
    const served = tierIfNonEmpty(
      fetched,
      productId,
      generation.fetchedAt,
      revalidated ? "cache" : "live",
    );
    if (served) return served;
    // Healthy fetch but no models for this product: fall through rather than persist a poisoned catalog.
  }

  if (cache) {
    const stale = tierIfNonEmpty(cache.catalog, productId, cache.fetchedAt, "cache");
    if (stale) return stale;
  }
  return snapshotTier();
};
