import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { z } from "zod";
import { readJsonFileSync, writeJsonFileSync } from "../fs.js";
import { log } from "../log.js";

interface DatedEntry {
  fetchedAt: string;
}

export const loadDiskCache = <T extends DatedEntry>(
  path: string,
  schema: z.ZodType<T>,
): T | null => {
  const data = readJsonFileSync<unknown>(path);
  if (!data) return null;
  const parsed = schema.safeParse(data);
  return parsed.success ? parsed.data : null;
};

export type DiskCacheState<T extends DatedEntry> =
  | { status: "ok"; entry: T }
  | { status: "missing" }
  | { status: "corrupt" };

export const persistDiskCache = <T extends DatedEntry>(path: string, entry: T): void => {
  writeJsonFileSync(path, entry);
};

/**
 * TTL freshness for any dated cache entry, bounded on both sides: a future-dated
 * `fetchedAt` (clock skew, a tampered or timezone-corrupted write) reads as a
 * negative age and would otherwise be treated as fresh forever, permanently
 * skipping refresh. The single source of truth for freshness across cache paths.
 */
export const isEntryFresh = (entry: DatedEntry, ttlMs: number): boolean => {
  const age = Date.now() - Date.parse(entry.fetchedAt);
  return Number.isFinite(age) && age >= 0 && age < ttlMs;
};

interface WithTtlAndFallbackOptions<T extends DatedEntry> {
  path: string;
  schema: z.ZodType<T>;
  ttlMs: number;
  fetcher: () => Promise<Result<T, { message: string }>>;
  /** Extra freshness predicate beyond TTL (e.g. OpenRouter's "has supported_parameters" check). */
  isCacheUsable?: (entry: T) => boolean;
  /** When the cache stores a key hash, only reuse entries whose hash matches the current key. */
  keyHashOf?: (entry: T) => string | undefined;
  currentKeyHash?: string;
}

interface DiskCacheResolution<T extends DatedEntry> {
  entry: T;
  cached: boolean;
  /** Whether the on-disk cache existed and was TTL-fresh, so callers can log without re-reading it. */
  cacheWasFresh: boolean;
}

export const withTtlAndFallback = async <T extends DatedEntry>(
  options: WithTtlAndFallbackOptions<T>,
): Promise<Result<DiskCacheResolution<T>, { message: string }>> => {
  const { path, schema, ttlMs, fetcher, isCacheUsable, keyHashOf, currentKeyHash } = options;

  const cache = loadDiskCache(path, schema);
  const keyMatches =
    keyHashOf === undefined || cache === null || keyHashOf(cache) === currentKeyHash;
  const cacheUsable = isCacheUsable === undefined || (cache !== null && isCacheUsable(cache));
  const cacheWasFresh = cache !== null && isEntryFresh(cache, ttlMs);

  if (cache && cacheWasFresh && cacheUsable && keyMatches)
    return ok({ entry: cache, cached: true, cacheWasFresh });

  const fetchResult = await fetcher();
  if (fetchResult.ok) {
    // Best-effort persist: a cache-write failure (EACCES/ENOSPC) must never fail a
    // request whose data is already in hand — the same contract the models.dev path
    // documents and implements.
    try {
      persistDiskCache(path, fetchResult.value);
    } catch (error) {
      log("warn", "disk_cache_persist_failed", { path, error: getErrorMessage(error) });
    }
    return ok({ entry: fetchResult.value, cached: false, cacheWasFresh });
  }

  // On a fetch failure the cache is the last resort, but only if it is one we
  // would actually serve fresh: an unusable cache (e.g. missing the gating field)
  // must surface the fetch error, not be served as a silent degraded fallback.
  if (cache && keyMatches && cacheUsable) return ok({ entry: cache, cached: true, cacheWasFresh });
  return err({ message: fetchResult.error.message });
};
