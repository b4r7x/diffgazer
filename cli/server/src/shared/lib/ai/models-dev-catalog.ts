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
import { getGlobalModelsDevCatalogPath } from "../paths.js";
import { type DiskCacheState, isEntryFresh, persistDiskCache } from "./disk-cache.js";

const MODELS_DEV_URL = "https://models.dev/api.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Reject a live payload smaller than this fraction of the known baseline. */
const SHRINK_GUARD_RATIO = 0.5;
/**
 * Upper bound on the buffered models.dev response. The real catalog is ~2 MB; a
 * compromised upstream/proxy returning a multi-hundred-MB body must be rejected
 * before `response.json()` reads it all into the in-process CLI server's memory.
 */
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

/** Exported as a test seam: colocated tests round-trip the on-disk cache shape. */
export const ModelsDevCatalogCacheSchema = z.object({
  catalog: ModelsDevCatalogSchema,
  fetchedAt: z.string().datetime(),
});
type ModelsDevCatalogCache = z.infer<typeof ModelsDevCatalogCacheSchema>;

/**
 * The validated catalog from the most recent successful parse, keyed by the cache
 * generation's `fetchedAt`. The disk cache holds the full ~2 MB multi-provider
 * payload; re-running `ModelsDevCatalogSchema.safeParse` over all of it on every
 * request (a picker open fans out one request per enabled provider) is the hot-path
 * cost. Each `persistDiskCache` stamps a new ISO `fetchedAt`, so the timestamp
 * identifies a generation: a cheap raw read plus a `fetchedAt` match lets repeated
 * requests reuse the parsed catalog and skip the full revalidation.
 */
let parsedCacheMemo: ModelsDevCatalogCache | null = null;

/**
 * Test seam: clears the per-generation parse memo so tests that reuse a
 * same-millisecond `fetchedAt` across distinct catalogs do not see a stale hit.
 * Production never needs this — each persisted generation carries a new timestamp.
 */
export const resetCatalogParseMemo = (): void => {
  parsedCacheMemo = null;
};

const peekFetchedAt = (raw: unknown): string | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const value = (raw as Record<string, unknown>).fetchedAt;
  return typeof value === "string" ? value : undefined;
};

/**
 * Reads the cache via `readJsonFileSyncSafe` and resolves the same
 * missing/corrupt/ok distinction the disk-cache primitives provide, but memoizes
 * the expensive full-catalog parse per cache generation. The distinction is
 * preserved exactly so the corrupt-quarantine and shrink-guard-baseline logic is
 * unchanged.
 */
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

const readJsonResponseWithLimit = async (
  response: Response,
): Promise<Result<unknown, { message: string }>> => {
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    return err({ message: `models.dev catalog response too large: ${declaredLength} bytes` });
  }

  if (!response.body) {
    try {
      return ok((await response.json()) as unknown);
    } catch (error) {
      return err({ message: getErrorMessage(error, "models.dev catalog response was not JSON") });
    }
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel("models.dev catalog response exceeded the size limit");
        return err({ message: `models.dev catalog response too large: ${receivedBytes} bytes` });
      }

      text += decoder.decode(value, { stream: true });
    }

    text += decoder.decode();
  } catch (error) {
    return err({ message: getErrorMessage(error, "Failed to read models.dev catalog response") });
  }

  try {
    return ok(JSON.parse(text) as unknown);
  } catch (error) {
    return err({ message: getErrorMessage(error, "models.dev catalog response was not JSON") });
  }
};

/**
 * The single live-fetch + parse + shrink/corruption-guard step. Exported as a
 * deliberate test seam so the guards can be exercised directly; production reaches
 * it only through `getProviderModels`.
 */
export const fetchModelsDevCatalog = async (options?: {
  baselineModelCount?: number;
}): Promise<Result<ModelsDevCatalog, { message: string }>> => {
  let response: Response;
  try {
    // `redirect: "error"` pins the destination to models.dev: a 3xx to a foreign
    // (or internal/link-local) host must fail rather than be followed, parsed, and
    // persisted into the shared on-disk cache.
    response = await fetch(MODELS_DEV_URL, {
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
  } catch (error) {
    return err({ message: getErrorMessage(error, "Failed to fetch models.dev catalog") });
  }
  if (!response.ok)
    return err({ message: `models.dev catalog request failed: ${response.status}` });

  const payloadResult = await readJsonResponseWithLimit(response);
  if (!payloadResult.ok) return payloadResult;

  const payload = payloadResult.value;

  const catalog = parseModelsDevCatalog(payload);
  const liveCount = countModels(catalog);
  const rawCount = countRawModels(payload);

  // Corruption guard: if per-model parsing silently dropped most of the upstream
  // payload, the post-parse count alone cannot see the mass-drop. Refuse a fetch
  // whose survivors fell far below the raw upstream size.
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

/**
 * The catalog function's result is exactly the slim HTTP response contract; alias
 * the Zod-derived `ProviderModelsResponse` so the wire shape has a single source
 * of truth and `service.ts` can return this value without a parallel type.
 */
export type ProviderModelsResult = ProviderModelsResponse;

type ResultSource = ProviderModelsResult["source"];

/**
 * Build a provider result only when the catalog actually yields models for the
 * provider. Returns null for a structurally-valid-but-provider-missing catalog so
 * the caller can fall through to the next tier instead of serving a blank picker.
 * `cached` is derived from `source`, never hand-passed, so an inconsistent
 * source/cached pair cannot be constructed.
 */
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

/**
 * models.dev keeps its own three-tier orchestration rather than routing through the
 * shared `withTtlAndFallback` (the D6 unification helper that OpenRouter uses). It
 * deliberately reuses the cache *primitives* (`readJsonFileSyncSafe` via
 * `loadCacheStateMemoized`, `persistDiskCache` via `persistIfNotDroppingProviders`)
 * and the shared `isEntryFresh` predicate, but the orchestration here models
 * behavior the two-tier helper does not: a third bundled-snapshot tier, a
 * per-provider non-empty fall-through (never a blank picker), a single-provider-drop
 * poison guard on persistence, and a corrupt-cache quarantine that still seeds a shrink-guard
 * baseline. Forcing it through `withTtlAndFallback` would lose those. See design.md
 * D6 for the recorded exception.
 */
export const getProviderModels = async (providerId: AIProvider): Promise<ProviderModelsResult> => {
  const path = getGlobalModelsDevCatalogPath();
  const cacheState = loadCacheStateMemoized(path);

  // A present-but-unloadable cache must not be mistaken for a baseline-free first
  // run: quarantine it and use the bundled snapshot count as the emergency floor,
  // so the next fetch is still shrink-guarded.
  if (cacheState.status === "corrupt") {
    try {
      const backupPath = quarantineCorruptFile(path);
      console.warn(`[models-dev-catalog] quarantined unloadable cache to ${backupPath}`);
    } catch (error) {
      console.warn(
        `[models-dev-catalog] failed to quarantine unloadable cache: ${getErrorMessage(error)}`,
      );
    }
  }
  const cache = cacheState.status === "ok" ? cacheState.entry : null;

  if (cache && isEntryFresh(cache, CACHE_TTL_MS)) {
    const fresh = resultIfNonEmpty(cache.catalog, providerId, cache.fetchedAt, "cache");
    if (fresh) return fresh;
  }

  if (isOffline()) {
    if (cache) {
      // The fresh-cache tier above already returned for a TTL-fresh hit, so a cache
      // served here is stale-beyond-TTL. The `source` tag stays "cache" (a new tag
      // would ripple through the cross-package ProviderModelsResponse enum and every
      // consumer); `fetchedAt` is the honest staleness signal the response already
      // carries, and this log makes the stale offline serve observable server-side.
      const stale = resultIfNonEmpty(cache.catalog, providerId, cache.fetchedAt, "cache");
      if (stale) {
        console.info(
          `[models-dev-catalog] offline: serving stale cache (fetchedAt=${cache.fetchedAt}) for ${providerId}`,
        );
        return stale;
      }
    }
    return snapshotResult(providerId);
  }

  // Shrink-guard against the prior trusted cache when we have one. When the cache
  // exists but could not be loaded, fall back to the bundled snapshot count as an
  // emergency baseline rather than running the fetch with no shrink protection.
  const baselineModelCount = cache
    ? countModels(cache.catalog)
    : cacheState.status === "corrupt"
      ? countModels(CATALOG_SNAPSHOT)
      : 0;
  const fetchResult = await fetchModelsDevCatalog({ baselineModelCount });

  if (fetchResult.ok) {
    const fetchedAt = new Date().toISOString();
    const live = resultIfNonEmpty(fetchResult.value, providerId, fetchedAt, "live");
    if (live) {
      persistIfNotDroppingProviders(path, fetchResult.value, cache, fetchedAt);
      return live;
    }
    // The fetch is healthy overall but yields no models for this provider; fall
    // through to the cache/snapshot rather than persisting a poisoned catalog.
  }

  if (cache) {
    const stale = resultIfNonEmpty(cache.catalog, providerId, cache.fetchedAt, "cache");
    if (stale) return stale;
  }
  return snapshotResult(providerId);
};

/**
 * Persist a freshly fetched catalog, but never overwrite a trusted cache with one
 * that drops an enabled overlay provider the trusted cache still had — a single
 * upstream drop would otherwise poison the shared on-disk cache. The write is
 * best-effort: a disk failure must never fail a request whose data is in hand,
 * and must never reflect the cache path to the HTTP client.
 */
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
        console.warn(
          `[models-dev-catalog] refusing to persist live catalog: enabled source ${sourceId} was dropped`,
        );
        return;
      }
    }
  }
  const entry: ModelsDevCatalogCache = { catalog, fetchedAt };
  try {
    persistDiskCache(path, entry);
    // The just-written generation is the freshest parse: seed the memo so the
    // immediate follow-up request reuses it instead of re-validating from disk.
    parsedCacheMemo = entry;
  } catch (error) {
    console.warn(`[models-dev-catalog] failed to persist catalog cache: ${getErrorMessage(error)}`);
  }
};
