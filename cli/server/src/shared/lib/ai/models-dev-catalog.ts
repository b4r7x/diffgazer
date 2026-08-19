import { createHash, randomUUID } from "node:crypto";
import {
  CATALOG_SNAPSHOT,
  type CatalogObservationSource,
  isOfferableObservation,
  type ModelsDevCatalog,
  ModelsDevCatalogSchema,
  PROVIDER_OVERLAY,
  parseModelsDevCatalog,
  transformCatalogObservation,
} from "@diffgazer/core/catalog";
import { getErrorMessage } from "@diffgazer/core/errors";
import {
  CATALOG_EMPTY_MODELS_REASON,
  CATALOG_SKIPPED_REASON,
  isModelIdAllowedForProduct,
  LIVE_ONLY_MODEL_DESCRIPTION,
  PRODUCT_REGISTRY,
} from "@diffgazer/core/providers";
import { err, ok, type Result } from "@diffgazer/core/result";
import type {
  ConfigurationId,
  ModelInfo,
  ProviderModelsResponse,
  RunnableProductId,
} from "@diffgazer/core/schemas/config";
import { z } from "zod";
import { getFileMtimeMs, quarantineCorruptFile, readJsonFileSyncSafe } from "../fs.js";
import { log } from "../log.js";
import { getGlobalModelsDevCatalogPath } from "../paths.js";
import { type DiskCacheState, isEntryFresh, persistDiskCache } from "./disk-cache.js";
import { readJsonResponseWithLimit } from "./http-json.js";
import { type LiveModel, type LiveModelList, resolveLiveModelList } from "./live-model-lists.js";

const MODELS_DEV_URL = "https://models.dev/api.json";
const CACHE_TTL_MS = 60 * 60 * 1000;
/** Reject a live payload smaller than this fraction of the known baseline. */
const SHRINK_GUARD_RATIO = 0.5;

export const ModelsDevCatalogCacheSchema = z.object({
  catalog: ModelsDevCatalogSchema,
  fetchedAt: z.iso.datetime(),
  generationId: z.uuid().optional(),
  /** models.dev's ETag for `catalog`; sent back as If-None-Match once the TTL lapses. */
  etag: z.string().optional(),
});
type ModelsDevCatalogCache = z.infer<typeof ModelsDevCatalogCacheSchema>;

export type CatalogObservableProductId = keyof typeof PROVIDER_OVERLAY & RunnableProductId;

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

interface ParsedCacheMemo {
  path: string;
  identity: string;
  mtimeMs: number | null;
  entry: ModelsDevCatalogCache;
}

interface LoadedCacheState {
  state: DiskCacheState<ModelsDevCatalogCache>;
  identity: string;
}

interface CatalogFetchGeneration {
  result: Result<ModelsDevFetch, { message: string }>;
  fetchedAt: string;
}

interface CatalogFlight {
  requestedProducts: Set<CatalogObservableProductId>;
  promise: Promise<CatalogFetchGeneration>;
}

const catalogFlights = new Map<string, CatalogFlight>();

let parsedCacheMemo: ParsedCacheMemo | null = null;

const CacheGenerationSchema = z.object({ generationId: z.uuid() });

const getCacheIdentity = (raw: unknown): string => {
  const generation = CacheGenerationSchema.safeParse(raw);
  if (generation.success) return `generation:${generation.data.generationId}`;
  return `legacy:${createHash("sha256").update(JSON.stringify(raw)).digest("hex")}`;
};

const loadCacheStateMemoized = (path: string): LoadedCacheState => {
  const mtimeMs = getFileMtimeMs(path);
  // Freshness gate before the multi-megabyte read: an unchanged file serves the
  // memoized entry without re-reading, JSON.parse-ing, or re-hashing it.
  const memo = parsedCacheMemo;
  if (memo?.path === path && mtimeMs !== null && memo.mtimeMs === mtimeMs) {
    return { state: { status: "ok", entry: memo.entry }, identity: memo.identity };
  }

  const read = readJsonFileSyncSafe<unknown>(path);
  if (read.status === "missing") return { state: { status: "missing" }, identity: "none" };
  if (read.status === "corrupt") return { state: { status: "corrupt" }, identity: "none" };

  const identity = getCacheIdentity(read.data);
  if (memo?.path === path && memo.identity === identity) {
    parsedCacheMemo = { ...memo, mtimeMs };
    return { state: { status: "ok", entry: memo.entry }, identity };
  }

  const parsed = ModelsDevCatalogCacheSchema.safeParse(read.data);
  if (!parsed.success) return { state: { status: "corrupt" }, identity: "none" };
  parsedCacheMemo = { path, identity, mtimeMs, entry: parsed.data };
  return { state: { status: "ok", entry: parsed.data }, identity };
};

const countModels = (catalog: ModelsDevCatalog): number => {
  let total = 0;
  for (const provider of Object.values(catalog)) total += Object.keys(provider.models).length;
  return total;
};

/** Count the model entries in a raw upstream payload, before per-model parsing drops invalid ones. */
const countRawModels = (payload: unknown): number => {
  if (!payload || typeof payload !== "object") return 0;
  let total = 0;
  for (const provider of Object.values(payload as Record<string, unknown>)) {
    const models =
      provider && typeof provider === "object"
        ? (provider as Record<string, unknown>).models
        : undefined;
    if (models && typeof models === "object") total += Object.keys(models).length;
  }
  return total;
};

const isCatalogObservableProduct = (
  productId: RunnableProductId,
): productId is CatalogObservableProductId => PROVIDER_OVERLAY[productId] !== undefined;

/** Registry-owned overlay source ids — catalog observations never enable products. */
const catalogOverlaySourceIds = (): Set<string> => {
  const ids = new Set<string>();
  for (const overlay of Object.values(PROVIDER_OVERLAY)) {
    if (!overlay) continue;
    for (const sourceId of overlay.modelsDevIds) ids.add(sourceId);
  }
  return ids;
};

/** Overlay source ids that carry at least one model in the given catalog. */
const populatedCatalogOverlaySourceIds = (catalog: ModelsDevCatalog): Set<string> => {
  const populated = new Set<string>();
  for (const sourceId of catalogOverlaySourceIds()) {
    const source = catalog[sourceId];
    if (source && Object.keys(source.models).length > 0) populated.add(sourceId);
  }
  return populated;
};

const observationSourceForResult = (source: CatalogTierSource): CatalogObservationSource =>
  source === "snapshot" ? "models.dev-snapshot" : "models.dev-live";

const describeObservation = (contextTokens?: number): string => {
  if (contextTokens === undefined || contextTokens < 1000) return "";
  const thousands = Math.round(contextTokens / 1000);
  if (thousands >= 1000) {
    const millions = (contextTokens / 1_000_000).toFixed(1).replace(/\.0$/, "");
    return `${millions}M context`;
  }
  return `${thousands}K context`;
};

/**
 * Map bounded product observations to picker rows without conferring admission
 * or billing. Only models the product's model policy admits — and, for
 * strict-JSON-schema products, not published as unable to return structured
 * output — are offered, and the tier repeats the catalog's own per-model price
 * rather than a curated free-quota guess. Applying the policy here — not only
 * at the API boundary — is what lets
 * a product whose whole offering is filtered away report an honest empty
 * discovery instead of a silently blank picker.
 */
export const modelInfoFromBoundedObservation = (
  catalog: ModelsDevCatalog,
  productId: CatalogObservableProductId,
  observationSource: CatalogObservationSource,
  checkedAt: string,
): ModelInfo[] => {
  const observations = transformCatalogObservation({
    source: observationSource,
    checkedAt,
    catalog,
  });
  const productObservation = observations.find(
    (observation) => observation.productId === productId,
  );
  if (!productObservation) return [];

  return productObservation.models
    .filter((model) => isOfferableObservation(productId, model))
    .map((model) => ({
      id: model.modelId,
      name: model.modelName,
      description: describeObservation(model.contextTokens),
      tier: model.billing,
    }));
};

const isOffline = (): boolean => {
  const flag = process.env.DIFFGAZER_OFFLINE?.trim();
  return flag !== undefined && flag !== "" && flag !== "0" && flag.toLowerCase() !== "false";
};

export interface ModelsDevFetch {
  readonly catalog: ModelsDevCatalog;
  readonly etag: string | null;
  /** models.dev answered 304 to `revalidate.etag`: `catalog` is the cached one, current again. */
  readonly revalidated: boolean;
}

// Live fetch + parse + shrink/corruption guard. Exported as a test seam; production reaches it via getProviderModels.
export const fetchModelsDevCatalog = async (options?: {
  baselineModelCount?: number;
  revalidate?: { etag: string; catalog: ModelsDevCatalog };
}): Promise<Result<ModelsDevFetch, { message: string }>> => {
  const revalidate = options?.revalidate;
  let response: Response;
  try {
    // redirect: "error" pins the destination to models.dev — a 3xx to a foreign or
    // link-local host MUST fail, not be followed and persisted into the shared cache.
    response = await fetch(MODELS_DEV_URL, {
      ...(revalidate ? { headers: { "if-none-match": revalidate.etag } } : {}),
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
  } catch (error) {
    return err({ message: getErrorMessage(error, "Failed to fetch models.dev catalog") });
  }
  if (revalidate && response.status === 304) {
    return ok({ catalog: revalidate.catalog, etag: revalidate.etag, revalidated: true });
  }
  if (!response.ok)
    return err({ message: `models.dev catalog request failed: ${response.status}` });

  const payloadResult = await readJsonResponseWithLimit(response, "models.dev catalog");
  if (!payloadResult.ok) return payloadResult;

  const payload = payloadResult.value;

  const catalog = parseModelsDevCatalog(payload);
  const liveCount = countModels(catalog);
  const rawCount = countRawModels(payload);

  // Corruption guard: the post-parse count can't see a mass silent drop, so compare
  // survivors against the raw upstream size.
  if (rawCount > 0 && liveCount < rawCount * SHRINK_GUARD_RATIO) {
    return err({
      message: `models.dev catalog corruption-guard tripped: ${liveCount} of ${rawCount} raw models survived parsing`,
    });
  }

  const baseline = options?.baselineModelCount ?? 0;
  if (baseline > 0 && liveCount < baseline * SHRINK_GUARD_RATIO) {
    return err({
      message: `models.dev catalog shrink-guard tripped: ${liveCount} models vs baseline ${baseline}`,
    });
  }
  if (liveCount === 0) return err({ message: "models.dev catalog parsed to zero models" });

  return ok({ catalog, etag: response.headers.get("etag"), revalidated: false });
};

type CatalogTierSource = "live" | "cache" | "snapshot";

/** The models.dev catalog a request resolved to, and which tier served it. */
interface CatalogTier {
  readonly catalog: ModelsDevCatalog;
  readonly fetchedAt: string;
  readonly source: CatalogTierSource;
}

// Returns null when the catalog yields no models for the product so the caller
// falls through to the next tier instead of serving a blank picker.
const tierIfNonEmpty = (
  catalog: ModelsDevCatalog,
  productId: CatalogObservableProductId,
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
  productId: CatalogObservableProductId;
  baselineModelCount: number;
  trustedCache: ModelsDevCatalogCache | null;
}): Promise<CatalogFetchGeneration> => {
  const active = catalogFlights.get(options.key);
  if (active) {
    active.requestedProducts.add(options.productId);
    return active.promise;
  }

  const requestedProducts = new Set<CatalogObservableProductId>([options.productId]);
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

const resolveCatalogTier = async (productId: CatalogObservableProductId): Promise<CatalogTier> => {
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

/** Every model key the catalog carries for the product's overlay sources, offered or withheld. */
const catalogModelIds = (
  catalog: ModelsDevCatalog,
  productId: CatalogObservableProductId,
): Set<string> => {
  const ids = new Set<string>();
  for (const sourceId of PROVIDER_OVERLAY[productId]?.modelsDevIds ?? []) {
    for (const modelKey of Object.keys(catalog[sourceId]?.models ?? {})) ids.add(modelKey);
  }
  return ids;
};

/** The display name a same-vendor models.dev source carries for the identical key, if any. */
const borrowedCatalogName = (
  catalog: ModelsDevCatalog,
  productId: CatalogObservableProductId,
  modelId: string,
): string | undefined => {
  for (const sourceId of PROVIDER_OVERLAY[productId]?.nameSourceIds ?? []) {
    const name = catalog[sourceId]?.models[modelId]?.name;
    if (name) return name;
  }
  return undefined;
};

const describeLiveOnly = (model: LiveModel): string => {
  const context = describeObservation(model.contextTokens);
  if (model.tier !== "unknown") return context;
  return context ? `${context} · pricing unknown` : LIVE_ONLY_MODEL_DESCRIPTION;
};

/**
 * The provider's live list is the id set; models.dev supplies the row where it
 * knows the id. A model the catalog knows but withheld (non-text output, or a
 * declared structured-output refusal on a strict-schema product) stays
 * withheld — the live list only adds ids the catalog has never seen, and those
 * still pass the product's model policy. On a strict-schema product the live
 * list's own capability declaration withholds a route too, whether or not the
 * catalog knows it: the provider is the authority on what its routes accept.
 * A live-only row may borrow a display name from a same-vendor source, never
 * its price: the tier stays unknown and the row says so.
 */
const mergeLiveModelList = (
  catalog: ModelsDevCatalog,
  productId: CatalogObservableProductId,
  offered: readonly ModelInfo[],
  live: readonly LiveModel[],
): ModelInfo[] => {
  const offeredById = new Map(offered.map((model) => [model.id, model]));
  const known = catalogModelIds(catalog, productId);
  const strictSchema =
    PRODUCT_REGISTRY[productId].admission.structuredOutput === "strict-json-schema";
  const merged: ModelInfo[] = [];
  for (const model of live) {
    if (strictSchema && model.structuredOutput === false) continue;
    const offeredModel = offeredById.get(model.id);
    if (offeredModel) {
      merged.push(offeredModel);
      continue;
    }
    if (known.has(model.id) || !isModelIdAllowedForProduct(productId, model.id)) continue;
    merged.push({
      id: model.id,
      name: model.name ?? borrowedCatalogName(catalog, productId, model.id) ?? model.id,
      description: describeLiveOnly(model),
      tier: model.tier,
    });
  }
  return merged.sort((left, right) => {
    if (left.id < right.id) return -1;
    if (left.id > right.id) return 1;
    return 0;
  });
};

const providerModelsResponse = (
  models: ModelInfo[],
  fetchedAt: string,
  source: ProviderModelsResponse["source"],
): ProviderModelsResponse =>
  source === "cache" || source === "provider-cache"
    ? { models, fetchedAt, source, cached: true }
    : { models, fetchedAt, source, cached: false };

const providerModelsFromTier = (
  tier: CatalogTier,
  productId: CatalogObservableProductId,
  liveList: LiveModelList | null,
): ProviderModelsResponse => {
  const offered = modelInfoFromBoundedObservation(
    tier.catalog,
    productId,
    observationSourceForResult(tier.source),
    tier.fetchedAt,
  );
  if (!liveList) return providerModelsResponse(offered, tier.fetchedAt, tier.source);
  const merged = mergeLiveModelList(tier.catalog, productId, offered, liveList.models);
  if (merged.length === 0) {
    // A list naming only ids the product policy rejects (a provider that lists
    // aliases such as `deepseek-chat` instead of exact ids) must not blank a
    // picker the catalog can still fill.
    log("info", "live_model_list_ignored", { productId });
    return providerModelsResponse(offered, tier.fetchedAt, tier.source);
  }
  return providerModelsResponse(
    merged,
    liveList.fetchedAt,
    liveList.cached ? "provider-cache" : "provider-live",
  );
};

/**
 * Shared reader so discovery and picker paths stay aligned; tests may spy on
 * `.get`. The live list is awaited alongside the catalog tier: the two requests
 * are independent, so a cold open pays the slower of them, not the sum.
 */
export const catalogProviderModels = {
  get: async (
    productId: CatalogObservableProductId,
    liveList: Promise<LiveModelList | null> | null = null,
  ): Promise<ProviderModelsResponse> => {
    const [tier, list] = await Promise.all([resolveCatalogTier(productId), liveList]);
    return providerModelsFromTier(tier, productId, list);
  },
};

// Three-tier orchestration: a bundled-snapshot tier, per-product non-empty
// fall-through, a single-source-drop poison guard, and a corrupt-cache
// quarantine that still seeds a shrink-guard baseline. See design.md D6.
export const getProviderModels = async (
  productId: RunnableProductId,
): Promise<ProviderModelsResponse> => {
  if (!isCatalogObservableProduct(productId)) {
    const fetchedAt = new Date().toISOString();
    return { models: [], fetchedAt, source: "snapshot", cached: false };
  }
  return catalogProviderModels.get(productId);
};

export const discoverConfigurationCatalog = async (
  tuple: CatalogDiscoveryTuple,
): Promise<ConfigurationCatalogDiscovery> => {
  const checkedAt = new Date().toISOString();
  if (!isCatalogObservableProduct(tuple.productId)) {
    return {
      ...tuple,
      status: "skipped",
      models: [],
      reason: CATALOG_SKIPPED_REASON,
      checkedAt,
    };
  }

  const response = await catalogProviderModels.get(
    tuple.productId,
    isOffline() ? null : resolveLiveModelList(tuple),
  );
  if (response.models.length === 0) {
    return {
      ...tuple,
      status: "skipped",
      models: [],
      reason: CATALOG_EMPTY_MODELS_REASON,
      checkedAt,
    };
  }
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

// MUST NOT overwrite a trusted cache with one that drops a registry overlay source
// the trusted cache still had — a single upstream drop would poison the shared cache.
// Best-effort write: a disk failure must not fail a request whose data is in hand.
const persistIfNotDroppingProviders = (
  path: string,
  fetched: { catalog: ModelsDevCatalog; fetchedAt: string; etag: string | null },
  trustedCache: ModelsDevCatalogCache | null,
): void => {
  const { catalog, fetchedAt, etag } = fetched;
  if (trustedCache) {
    const before = populatedCatalogOverlaySourceIds(trustedCache.catalog);
    const after = populatedCatalogOverlaySourceIds(catalog);
    for (const sourceId of before) {
      if (!after.has(sourceId)) {
        log("warn", "models_dev_catalog_persist_refused", { droppedSource: sourceId });
        return;
      }
    }
  }
  const entry: ModelsDevCatalogCache = {
    catalog,
    fetchedAt,
    generationId: randomUUID(),
    ...(etag === null ? {} : { etag }),
  };
  try {
    persistDiskCache(path, entry);
    parsedCacheMemo = {
      path,
      identity: `generation:${entry.generationId}`,
      mtimeMs: getFileMtimeMs(path),
      entry,
    };
  } catch (error) {
    log("warn", "models_dev_catalog_persist_failed", { error: getErrorMessage(error) });
  }
};
