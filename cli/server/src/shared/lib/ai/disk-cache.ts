import type { z } from "zod";
import { type Result, ok, err } from "@diffgazer/core/result";
import { readJsonFileSync, readJsonFileSyncSafe, writeJsonFileSync } from "../fs.js";

interface DatedEntry {
  fetchedAt: string;
}

export const loadDiskCache = <T extends DatedEntry>(path: string, schema: z.ZodType<T>): T | null => {
  const data = readJsonFileSync<unknown>(path);
  if (!data) return null;
  const parsed = schema.safeParse(data);
  return parsed.success ? parsed.data : null;
};

export type DiskCacheState<T extends DatedEntry> =
  | { status: "ok"; entry: T }
  | { status: "missing" }
  | { status: "corrupt" };

/**
 * Like loadDiskCache, but distinguishes a genuinely-absent file from a
 * present-but-unloadable one (unreadable/invalid JSON, or a value that fails the
 * schema). Callers that derive a guard baseline from the cache need this so a
 * corrupt file does not masquerade as a baseline-free first run.
 */
export const loadDiskCacheState = <T extends DatedEntry>(path: string, schema: z.ZodType<T>): DiskCacheState<T> => {
  const read = readJsonFileSyncSafe<unknown>(path);
  if (read.status === "missing") return { status: "missing" };
  if (read.status === "corrupt") return { status: "corrupt" };
  const parsed = schema.safeParse(read.data);
  return parsed.success ? { status: "ok", entry: parsed.data } : { status: "corrupt" };
};

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
  const keyMatches = keyHashOf === undefined || cache === null || keyHashOf(cache) === currentKeyHash;
  const cacheUsable = isCacheUsable === undefined || (cache !== null && isCacheUsable(cache));
  const cacheWasFresh = cache !== null && isEntryFresh(cache, ttlMs);

  if (cache && cacheWasFresh && cacheUsable && keyMatches) return ok({ entry: cache, cached: true, cacheWasFresh });

  const fetchResult = await fetcher();
  if (fetchResult.ok) {
    persistDiskCache(path, fetchResult.value);
    return ok({ entry: fetchResult.value, cached: false, cacheWasFresh });
  }

  // On a fetch failure the cache is the last resort, but only if it is one we
  // would actually serve fresh: an unusable cache (e.g. missing the gating field)
  // must surface the fetch error, not be served as a silent degraded fallback.
  if (cache && keyMatches && cacheUsable) return ok({ entry: cache, cached: true, cacheWasFresh });
  return err({ message: fetchResult.error.message });
};
