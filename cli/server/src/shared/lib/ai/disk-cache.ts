import type { z } from "zod";
import { readJsonFileSync, writeJsonFileSync } from "../fs.js";

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
