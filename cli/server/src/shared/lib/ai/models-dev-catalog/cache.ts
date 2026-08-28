import { createHash, randomUUID } from "node:crypto";
import {
  type ModelsDevCatalog,
  ModelsDevCatalogSchema,
  PROVIDER_OVERLAY,
} from "@diffgazer/core/catalog";
import { getErrorMessage } from "@diffgazer/core/errors";
import { z } from "zod";
import { getFileMtimeMs, readJsonFileSyncSafe } from "../../fs.js";
import { log } from "../../log.js";
import { type DiskCacheState, persistDiskCache } from "../disk-cache.js";

export const ModelsDevCatalogCacheSchema = z.object({
  catalog: ModelsDevCatalogSchema,
  fetchedAt: z.iso.datetime(),
  generationId: z.uuid().optional(),
  /** models.dev's ETag for `catalog`; sent back as If-None-Match once the TTL lapses. */
  etag: z.string().optional(),
});
export type ModelsDevCatalogCache = z.infer<typeof ModelsDevCatalogCacheSchema>;

interface ParsedCacheMemo {
  path: string;
  identity: string;
  mtimeMs: number | null;
  entry: ModelsDevCatalogCache;
}

export interface LoadedCacheState {
  state: DiskCacheState<ModelsDevCatalogCache>;
  identity: string;
}

let parsedCacheMemo: ParsedCacheMemo | null = null;

const CacheGenerationSchema = z.object({ generationId: z.uuid() });

const getCacheIdentity = (raw: unknown): string => {
  const generation = CacheGenerationSchema.safeParse(raw);
  if (generation.success) return `generation:${generation.data.generationId}`;
  return `legacy:${createHash("sha256").update(JSON.stringify(raw)).digest("hex")}`;
};

export const loadCacheStateMemoized = (path: string): LoadedCacheState => {
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

export const countModels = (catalog: ModelsDevCatalog): number => {
  let total = 0;
  for (const provider of Object.values(catalog)) total += Object.keys(provider.models).length;
  return total;
};

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

// MUST NOT overwrite a trusted cache with one that drops a registry overlay source
// the trusted cache still had — a single upstream drop would poison the shared cache.
// Best-effort write: a disk failure must not fail a request whose data is in hand.
export const persistIfNotDroppingProviders = (
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
