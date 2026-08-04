import { createHash, randomUUID } from "node:crypto";
import {
  CATALOG_SNAPSHOT,
  type CatalogObservationSource,
  type ModelsDevCatalog,
  ModelsDevCatalogSchema,
  type ModelsDevModel,
  PROVIDER_OVERLAY,
  parseModelsDevCatalog,
  transformCatalogObservation,
} from "@diffgazer/core/catalog";
import { getErrorMessage } from "@diffgazer/core/errors";
import { CATALOG_EMPTY_MODELS_REASON, CATALOG_SKIPPED_REASON } from "@diffgazer/core/providers";
import { err, ok, type Result } from "@diffgazer/core/result";
import type {
  ConfigurationId,
  ModelInfo,
  ProviderModelsResponse,
  RunnableProductId,
} from "@diffgazer/core/schemas/config";
import { z } from "zod";
import { quarantineCorruptFile, readJsonFileSyncSafe } from "../fs.js";
import { log } from "../log.js";
import { getGlobalModelsDevCatalogPath } from "../paths.js";
import { type DiskCacheState, isEntryFresh, persistDiskCache } from "./disk-cache.js";
import { readJsonResponseWithLimit } from "./http-json.js";

const MODELS_DEV_URL = "https://models.dev/api.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Reject a live payload smaller than this fraction of the known baseline. */
const SHRINK_GUARD_RATIO = 0.5;

export const ModelsDevCatalogCacheSchema = z.object({
  catalog: ModelsDevCatalogSchema,
  fetchedAt: z.iso.datetime(),
  generationId: z.uuid().optional(),
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
      readonly observationSource: CatalogObservationSource;
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
  entry: ModelsDevCatalogCache;
}

interface LoadedCacheState {
  state: DiskCacheState<ModelsDevCatalogCache>;
  identity: string;
}

interface CatalogFetchGeneration {
  result: Result<ModelsDevCatalog, { message: string }>;
  fetchedAt: string;
}

interface CatalogFlight {
  requestedProducts: Set<CatalogObservableProductId>;
  promise: Promise<CatalogFetchGeneration>;
}

const catalogFlights = new Map<string, CatalogFlight>();

let parsedCacheMemo: ParsedCacheMemo | null = null;

const CacheGenerationSchema = z.object({ generationId: z.uuid() });

/** Curated free-quota coverage for overlay-populated products — not admission. */
type CatalogFreeTierCoverage =
  | "all"
  | "zero-priced-only"
  | { ids?: readonly string[]; families?: readonly string[] };

const CATALOG_FREE_TIER_COVERAGE: Partial<
  Record<CatalogObservableProductId, CatalogFreeTierCoverage>
> = {
  gemini: {
    ids: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"],
  },
  zai: "zero-priced-only",
  openrouter: "zero-priced-only",
  groq: "all",
  cerebras: "all",
  mistral: "zero-priced-only",
};

const pricingTierOf = (model: ModelsDevModel): "free" | "paid" | "unknown" => {
  if (!model.cost) return "unknown";
  return model.cost.input === 0 && model.cost.output === 0 ? "free" : "paid";
};

const matchesFreeTierCoverage = (
  model: ModelsDevModel,
  coverage: Exclude<CatalogFreeTierCoverage, "all" | "zero-priced-only">,
): boolean => {
  if (coverage.ids?.includes(model.id)) return true;
  if (model.family && coverage.families?.includes(model.family)) return true;
  return false;
};

const isCatalogModelFreeTier = (
  model: ModelsDevModel,
  productId: CatalogObservableProductId,
): boolean => {
  if (pricingTierOf(model) === "free") return true;

  const coverage = CATALOG_FREE_TIER_COVERAGE[productId];
  if (!coverage || coverage === "zero-priced-only") return false;
  if (coverage === "all") return true;
  return matchesFreeTierCoverage(model, coverage);
};

const lookupCatalogModel = (
  catalog: ModelsDevCatalog,
  sourceProviderId: string,
  modelId: string,
): ModelsDevModel | undefined => {
  const provider = catalog[sourceProviderId];
  if (!provider) return undefined;
  const model = provider.models[modelId];
  return model?.id === modelId ? model : undefined;
};

const getCacheIdentity = (raw: unknown): string => {
  const generation = CacheGenerationSchema.safeParse(raw);
  if (generation.success) return `generation:${generation.data.generationId}`;
  return `legacy:${createHash("sha256").update(JSON.stringify(raw)).digest("hex")}`;
};

const loadCacheStateMemoized = (path: string): LoadedCacheState => {
  const read = readJsonFileSyncSafe<unknown>(path);
  if (read.status === "missing") return { state: { status: "missing" }, identity: "none" };
  if (read.status === "corrupt") return { state: { status: "corrupt" }, identity: "none" };

  const identity = getCacheIdentity(read.data);
  if (parsedCacheMemo?.path === path && parsedCacheMemo.identity === identity) {
    return { state: { status: "ok", entry: parsedCacheMemo.entry }, identity };
  }

  const parsed = ModelsDevCatalogCacheSchema.safeParse(read.data);
  if (!parsed.success) return { state: { status: "corrupt" }, identity: "none" };
  parsedCacheMemo = { path, identity, entry: parsed.data };
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

const observationSourceForResult = (
  source: ProviderModelsResponse["source"],
): CatalogObservationSource => (source === "snapshot" ? "models.dev-snapshot" : "models.dev-live");

const describeObservation = (contextTokens?: number): string => {
  if (contextTokens === undefined || contextTokens < 1000) return "";
  const thousands = Math.round(contextTokens / 1000);
  if (thousands >= 1000) {
    const millions = (contextTokens / 1_000_000).toFixed(1).replace(/\.0$/, "");
    return `${millions}M context`;
  }
  return `${thousands}K context`;
};

/** Map bounded product observations to picker rows without conferring admission or billing. */
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

  return productObservation.models.map((model) => {
    const catalogModel = lookupCatalogModel(catalog, model.sourceProviderId, model.modelId);
    const tier =
      catalogModel && isCatalogModelFreeTier(catalogModel, productId)
        ? ("free" as const)
        : ("paid" as const);
    return {
      id: model.modelId,
      name: model.modelName,
      description: describeObservation(model.contextTokens),
      tier,
      ...(model.contextTokens === undefined ? {} : { contextLength: model.contextTokens }),
      ...(model.outputTokens === undefined ? {} : { maxOutputTokens: model.outputTokens }),
    };
  });
};

const isOffline = (): boolean => {
  const flag = process.env.DIFFGAZER_OFFLINE?.trim();
  return flag !== undefined && flag !== "" && flag !== "0" && flag.toLowerCase() !== "false";
};

// Live fetch + parse + shrink/corruption guard. Exported as a test seam; production reaches it via getProviderModels.
export const fetchModelsDevCatalog = async (options?: {
  baselineModelCount?: number;
}): Promise<Result<ModelsDevCatalog, { message: string }>> => {
  let response: Response;
  try {
    // redirect: "error" pins the destination to models.dev — a 3xx to a foreign or
    // link-local host MUST fail, not be followed and persisted into the shared cache.
    response = await fetch(MODELS_DEV_URL, {
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
  } catch (error) {
    return err({ message: getErrorMessage(error, "Failed to fetch models.dev catalog") });
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

  return ok(catalog);
};

type ResultSource = ProviderModelsResponse["source"];

// Returns null when the catalog yields no models for the product so the caller
// falls through to the next tier instead of serving a blank picker. `cached` is
// derived from `source` so the pair can't be constructed inconsistently.
const resultIfNonEmpty = (
  catalog: ModelsDevCatalog,
  productId: CatalogObservableProductId,
  fetchedAt: string,
  source: ResultSource,
): ProviderModelsResponse | null => {
  const models = modelInfoFromBoundedObservation(
    catalog,
    productId,
    observationSourceForResult(source),
    fetchedAt,
  );
  return models.length > 0 ? { models, fetchedAt, source, cached: source === "cache" } : null;
};

const snapshotResult = (productId: CatalogObservableProductId): ProviderModelsResponse => {
  const fetchedAt = new Date().toISOString();
  return {
    models: modelInfoFromBoundedObservation(
      CATALOG_SNAPSHOT,
      productId,
      "models.dev-snapshot",
      fetchedAt,
    ),
    fetchedAt,
    source: "snapshot",
    cached: false,
  };
};

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
  const promise = (async (): Promise<CatalogFetchGeneration> => {
    const result = await fetchModelsDevCatalog({
      baselineModelCount: options.baselineModelCount,
    });
    const fetchedAt = new Date().toISOString();
    const servesRequestedProduct =
      result.ok &&
      [...requestedProducts].some(
        (productId) => resultIfNonEmpty(result.value, productId, fetchedAt, "live") !== null,
      );

    if (result.ok && servesRequestedProduct) {
      persistIfNotDroppingProviders(options.path, result.value, options.trustedCache, fetchedAt);
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

const resolveProviderModels = async (
  productId: CatalogObservableProductId,
): Promise<ProviderModelsResponse> => {
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
    const fresh = resultIfNonEmpty(cache.catalog, productId, cache.fetchedAt, "cache");
    if (fresh) return fresh;
  }

  if (isOffline()) {
    if (cache) {
      // A cache served here is stale-beyond-TTL (the fresh tier above already returned
      // for a fresh hit); fetchedAt carries the honest staleness signal.
      const stale = resultIfNonEmpty(cache.catalog, productId, cache.fetchedAt, "cache");
      if (stale) {
        log("info", "models_dev_catalog_offline_stale_serve", {
          fetchedAt: cache.fetchedAt,
          productId,
        });
        return stale;
      }
    }
    return snapshotResult(productId);
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
    const live = resultIfNonEmpty(generation.result.value, productId, generation.fetchedAt, "live");
    if (live) return live;
    // Healthy fetch but no models for this product: fall through rather than persist a poisoned catalog.
  }

  if (cache) {
    const stale = resultIfNonEmpty(cache.catalog, productId, cache.fetchedAt, "cache");
    if (stale) return stale;
  }
  return snapshotResult(productId);
};

/** Shared reader so discovery and picker paths stay aligned; tests may spy on `.get`. */
export const catalogProviderModels = {
  get: (productId: CatalogObservableProductId): Promise<ProviderModelsResponse> =>
    resolveProviderModels(productId),
};

// Keeps its own three-tier orchestration instead of the shared withTtlAndFallback:
// it adds a bundled-snapshot tier, per-product non-empty fall-through, a
// single-source-drop poison guard, and a corrupt-cache quarantine that still
// seeds a shrink-guard baseline. See design.md D6 for the recorded exception.
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

  const response = await catalogProviderModels.get(tuple.productId);
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
    observationSource: observationSourceForResult(response.source),
    checkedAt: response.fetchedAt,
  };
};

// MUST NOT overwrite a trusted cache with one that drops a registry overlay source
// the trusted cache still had — a single upstream drop would poison the shared cache.
// Best-effort write: a disk failure must not fail a request whose data is in hand.
const persistIfNotDroppingProviders = (
  path: string,
  catalog: ModelsDevCatalog,
  trustedCache: ModelsDevCatalogCache | null,
  fetchedAt: string,
): void => {
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
  const entry: ModelsDevCatalogCache = { catalog, fetchedAt, generationId: randomUUID() };
  try {
    persistDiskCache(path, entry);
    parsedCacheMemo = {
      path,
      identity: `generation:${entry.generationId}`,
      entry,
    };
  } catch (error) {
    log("warn", "models_dev_catalog_persist_failed", { error: getErrorMessage(error) });
  }
};
