import {
  CATALOG_SNAPSHOT,
  catalogToModelInfo,
  type ModelsDevCatalog,
  ModelsDevCatalogSchema,
  PROVIDER_OVERLAY,
  parseModelsDevCatalog,
} from "@diffgazer/core/catalog";
import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { AIProvider, ProviderModelsResponse } from "@diffgazer/core/schemas/config";
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
});
type ModelsDevCatalogCache = z.infer<typeof ModelsDevCatalogCacheSchema>;

// Reuse the parsed catalog within a cache generation (keyed by fetchedAt) instead
// of re-parsing the ~2 MB payload on every per-provider request.
let parsedCacheMemo: ModelsDevCatalogCache | null = null;

// Test seam: distinct catalogs sharing a same-millisecond fetchedAt would otherwise hit the stale memo.
export const resetCatalogParseMemo = (): void => {
  parsedCacheMemo = null;
};

const peekFetchedAt = (raw: unknown): string | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const value = (raw as Record<string, unknown>).fetchedAt;
  return typeof value === "string" ? value : undefined;
};

const loadCacheStateMemoized = (path: string): DiskCacheState<ModelsDevCatalogCache> => {
  const read = readJsonFileSyncSafe<unknown>(path);
  if (read.status === "missing") return { status: "missing" };
  if (read.status === "corrupt") return { status: "corrupt" };

  const fetchedAt = peekFetchedAt(read.data);
  if (parsedCacheMemo && fetchedAt !== undefined && parsedCacheMemo.fetchedAt === fetchedAt) {
    return { status: "ok", entry: parsedCacheMemo };
  }

  const parsed = ModelsDevCatalogCacheSchema.safeParse(read.data);
  if (!parsed.success) return { status: "corrupt" };
  parsedCacheMemo = parsed.data;
  return { status: "ok", entry: parsed.data };
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

/** Source ids of every enabled overlay provider — the providers a picker can request. */
const enabledOverlaySourceIds = (): Set<string> => {
  const ids = new Set<string>();
  for (const overlay of Object.values(PROVIDER_OVERLAY)) {
    if (!overlay.enabled) continue;
    for (const sourceId of overlay.modelsDevIds) ids.add(sourceId);
  }
  return ids;
};

/** Enabled overlay source ids that carry at least one model in the given catalog. */
const populatedEnabledSourceIds = (catalog: ModelsDevCatalog): Set<string> => {
  const populated = new Set<string>();
  for (const sourceId of enabledOverlaySourceIds()) {
    const source = catalog[sourceId];
    if (source && Object.keys(source.models).length > 0) populated.add(sourceId);
  }
  return populated;
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

export type ProviderModelsResult = ProviderModelsResponse;

type ResultSource = ProviderModelsResult["source"];

// Returns null when the catalog yields no models for the provider so the caller
// falls through to the next tier instead of serving a blank picker. `cached` is
// derived from `source` so the pair can't be constructed inconsistently.
const resultIfNonEmpty = (
  catalog: ModelsDevCatalog,
  provider: AIProvider,
  fetchedAt: string,
  source: ResultSource,
): ProviderModelsResult | null => {
  const models = catalogToModelInfo(catalog, provider);
  return models.length > 0 ? { models, fetchedAt, source, cached: source === "cache" } : null;
};

const snapshotResult = (provider: AIProvider): ProviderModelsResult => ({
  models: catalogToModelInfo(CATALOG_SNAPSHOT, provider),
  fetchedAt: new Date().toISOString(),
  source: "snapshot",
  cached: false,
});

// Keeps its own three-tier orchestration instead of the shared withTtlAndFallback:
// it adds a bundled-snapshot tier, per-provider non-empty fall-through, a
// single-provider-drop poison guard, and a corrupt-cache quarantine that still
// seeds a shrink-guard baseline. See design.md D6 for the recorded exception.
export const getProviderModels = async (providerId: AIProvider): Promise<ProviderModelsResult> => {
  const path = getGlobalModelsDevCatalogPath();
  const cacheState = loadCacheStateMemoized(path);

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
    const fresh = resultIfNonEmpty(cache.catalog, providerId, cache.fetchedAt, "cache");
    if (fresh) return fresh;
  }

  if (isOffline()) {
    if (cache) {
      // A cache served here is stale-beyond-TTL (the fresh tier above already returned
      // for a fresh hit); fetchedAt carries the honest staleness signal.
      const stale = resultIfNonEmpty(cache.catalog, providerId, cache.fetchedAt, "cache");
      if (stale) {
        log("info", "models_dev_catalog_offline_stale_serve", {
          fetchedAt: cache.fetchedAt,
          providerId,
        });
        return stale;
      }
    }
    return snapshotResult(providerId);
  }

  // Shrink-guard baseline: the trusted cache, or the snapshot count when a corrupt
  // cache left us none, rather than fetching with no shrink protection.
  let baselineModelCount = 0;
  if (cache) {
    baselineModelCount = countModels(cache.catalog);
  } else if (cacheState.status === "corrupt") {
    baselineModelCount = countModels(CATALOG_SNAPSHOT);
  }
  const fetchResult = await fetchModelsDevCatalog({ baselineModelCount });

  if (fetchResult.ok) {
    const fetchedAt = new Date().toISOString();
    const live = resultIfNonEmpty(fetchResult.value, providerId, fetchedAt, "live");
    if (live) {
      persistIfNotDroppingProviders(path, fetchResult.value, cache, fetchedAt);
      return live;
    }
    // Healthy fetch but no models for this provider: fall through rather than persist a poisoned catalog.
  }

  if (cache) {
    const stale = resultIfNonEmpty(cache.catalog, providerId, cache.fetchedAt, "cache");
    if (stale) return stale;
  }
  return snapshotResult(providerId);
};

// MUST NOT overwrite a trusted cache with one that drops an enabled overlay provider
// the trusted cache still had — a single upstream drop would poison the shared cache.
// Best-effort write: a disk failure must not fail a request whose data is in hand.
const persistIfNotDroppingProviders = (
  path: string,
  catalog: ModelsDevCatalog,
  trustedCache: ModelsDevCatalogCache | null,
  fetchedAt: string,
): void => {
  if (trustedCache) {
    const before = populatedEnabledSourceIds(trustedCache.catalog);
    const after = populatedEnabledSourceIds(catalog);
    for (const sourceId of before) {
      if (!after.has(sourceId)) {
        log("warn", "models_dev_catalog_persist_refused", { droppedSource: sourceId });
        return;
      }
    }
  }
  const entry: ModelsDevCatalogCache = { catalog, fetchedAt };
  try {
    persistDiskCache(path, entry);
    parsedCacheMemo = entry;
  } catch (error) {
    log("warn", "models_dev_catalog_persist_failed", { error: getErrorMessage(error) });
  }
};
