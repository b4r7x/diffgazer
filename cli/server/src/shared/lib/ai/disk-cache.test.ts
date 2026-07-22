import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { log } from "../log.js";
import { isEntryFresh, loadDiskCache, persistDiskCache, withTtlAndFallback } from "./disk-cache.js";

// Boundary mock: logging writes process-visible diagnostics; cache tests assert fallback behavior without emitting logs.
vi.mock("../log.js", () => ({ log: vi.fn() }));

const EntrySchema = z.object({
  payload: z.array(z.string()),
  fetchedAt: z.string(),
  keyHash: z.string().optional(),
});
type Entry = z.infer<typeof EntrySchema>;

let testDir: string;
const cachePath = (): string => path.join(testDir, "cache.json");
const writeRaw = (value: unknown): void => {
  fs.writeFileSync(cachePath(), `${JSON.stringify(value, null, 2)}\n`);
};

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "dg-disk-cache-"));
  vi.restoreAllMocks();
  vi.mocked(log).mockClear();
});
afterEach(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe("loadDiskCache", () => {
  it("returns null when the file does not exist", () => {
    expect(loadDiskCache(cachePath(), EntrySchema)).toBeNull();
  });
  it("returns null when the stored value fails schema validation", () => {
    writeRaw({ payload: "not-an-array", fetchedAt: "x" });
    expect(loadDiskCache(cachePath(), EntrySchema)).toBeNull();
  });
  it("returns the parsed entry when valid", () => {
    const entry: Entry = { payload: ["a", "b"], fetchedAt: new Date().toISOString() };
    writeRaw(entry);
    expect(loadDiskCache(cachePath(), EntrySchema)).toEqual(entry);
  });
});

describe("persistDiskCache", () => {
  it("writes the entry so loadDiskCache reads it back", () => {
    const entry: Entry = { payload: ["x"], fetchedAt: new Date().toISOString() };
    persistDiskCache(cachePath(), entry);
    expect(loadDiskCache(cachePath(), EntrySchema)).toEqual(entry);
  });
});

describe("isEntryFresh", () => {
  const ttl = 24 * 60 * 60 * 1000;

  it("treats a recent entry within the TTL as fresh", () => {
    expect(isEntryFresh({ fetchedAt: new Date().toISOString() }, ttl)).toBe(true);
  });

  it("treats an entry older than the TTL as stale", () => {
    expect(isEntryFresh({ fetchedAt: new Date(Date.now() - ttl - 1000).toISOString() }, ttl)).toBe(
      false,
    );
  });

  it("treats a future-dated entry as not fresh so a refresh can re-run", () => {
    expect(isEntryFresh({ fetchedAt: new Date(Date.now() + ttl).toISOString() }, ttl)).toBe(false);
  });

  it("treats an unparseable timestamp as not fresh", () => {
    expect(isEntryFresh({ fetchedAt: "not-a-date" }, ttl)).toBe(false);
  });
});

describe("withTtlAndFallback", () => {
  const fresh = (): string => new Date().toISOString();
  const stale = (): string => new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  const ttl = 24 * 60 * 60 * 1000;

  it("returns the fresh cache without fetching", async () => {
    persistDiskCache(cachePath(), { payload: ["cached"], fetchedAt: fresh() } satisfies Entry);
    const fetcher = vi.fn();
    const result = await withTtlAndFallback({
      path: cachePath(),
      schema: EntrySchema,
      ttlMs: ttl,
      fetcher,
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cached).toBe(true);
      expect(result.value.cacheWasFresh).toBe(true);
      expect(result.value.entry.payload).toEqual(["cached"]);
    }
  });

  it("fetches and persists when no cache exists", async () => {
    const entry: Entry = { payload: ["live"], fetchedAt: fresh() };
    const fetcher = vi.fn().mockResolvedValue({ ok: true, value: entry });
    const result = await withTtlAndFallback({
      path: cachePath(),
      schema: EntrySchema,
      ttlMs: ttl,
      fetcher,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cached).toBe(false);
      expect(result.value.entry.payload).toEqual(["live"]);
    }
    expect(loadDiskCache(cachePath(), EntrySchema)?.payload).toEqual(["live"]);
  });

  it("fetches when the cache is stale", async () => {
    persistDiskCache(cachePath(), { payload: ["old"], fetchedAt: stale() } satisfies Entry);
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      value: { payload: ["new"], fetchedAt: fresh() } satisfies Entry,
    });
    const result = await withTtlAndFallback({
      path: cachePath(),
      schema: EntrySchema,
      ttlMs: ttl,
      fetcher,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cacheWasFresh).toBe(false);
      expect(result.value.entry.payload).toEqual(["new"]);
    }
  });

  it("falls back to the stale cache when the fetch fails", async () => {
    persistDiskCache(cachePath(), { payload: ["old"], fetchedAt: stale() } satisfies Entry);
    const fetcher = vi.fn().mockResolvedValue({ ok: false, error: { message: "boom" } });
    const result = await withTtlAndFallback({
      path: cachePath(),
      schema: EntrySchema,
      ttlMs: ttl,
      fetcher,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cached).toBe(true);
      expect(result.value.entry.payload).toEqual(["old"]);
    }
  });

  it("returns the fetch error when it fails and no cache exists", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, error: { message: "boom" } });
    const result = await withTtlAndFallback({
      path: cachePath(),
      schema: EntrySchema,
      ttlMs: ttl,
      fetcher,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("boom");
  });

  it("treats a fresh cache as a miss when isCacheUsable returns false", async () => {
    persistDiskCache(cachePath(), { payload: [], fetchedAt: fresh() } satisfies Entry);
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      value: { payload: ["refreshed"], fetchedAt: fresh() } satisfies Entry,
    });
    const result = await withTtlAndFallback({
      path: cachePath(),
      schema: EntrySchema,
      ttlMs: ttl,
      fetcher,
      isCacheUsable: (c) => c.payload.length > 0,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.entry.payload).toEqual(["refreshed"]);
  });

  it("does not reuse a stale cache whose keyHash does not match", async () => {
    persistDiskCache(cachePath(), {
      payload: ["old"],
      fetchedAt: stale(),
      keyHash: "OTHER",
    } satisfies Entry);
    const fetcher = vi.fn().mockResolvedValue({ ok: false, error: { message: "down" } });
    const result = await withTtlAndFallback({
      path: cachePath(),
      schema: EntrySchema,
      ttlMs: ttl,
      fetcher,
      keyHashOf: (c) => c.keyHash,
      currentKeyHash: "MINE",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("down");
  });

  it("surfaces the fetch error instead of an unusable cache on the fallback path", async () => {
    // Fresh cache that fails isCacheUsable, so the fetch is forced; the fetch then fails.
    persistDiskCache(cachePath(), { payload: [], fetchedAt: fresh() } satisfies Entry);
    const fetcher = vi.fn().mockResolvedValue({ ok: false, error: { message: "upstream down" } });
    const result = await withTtlAndFallback({
      path: cachePath(),
      schema: EntrySchema,
      ttlMs: ttl,
      fetcher,
      isCacheUsable: (c) => c.payload.length > 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("upstream down");
  });

  it("does not persist or return an unusable successful fetch", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      value: { payload: [], fetchedAt: fresh(), keyHash: "MINE" } satisfies Entry,
    });
    const result = await withTtlAndFallback({
      path: cachePath(),
      schema: EntrySchema,
      ttlMs: ttl,
      fetcher,
      isCacheUsable: (c) => c.payload.length > 0,
      keyHashOf: (c) => c.keyHash,
      currentKeyHash: "MINE",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("Fetched cache entry is unusable");
    expect(fs.existsSync(cachePath())).toBe(false);
  });

  it("returns a matching usable stale cache for an unusable successful fetch", async () => {
    const cached: Entry = {
      payload: ["cached"],
      fetchedAt: stale(),
      keyHash: "MINE",
    };
    persistDiskCache(cachePath(), cached);
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      value: { payload: [], fetchedAt: fresh(), keyHash: "MINE" } satisfies Entry,
    });
    const result = await withTtlAndFallback({
      path: cachePath(),
      schema: EntrySchema,
      ttlMs: ttl,
      fetcher,
      isCacheUsable: (c) => c.payload.length > 0,
      keyHashOf: (c) => c.keyHash,
      currentKeyHash: "MINE",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cached).toBe(true);
      expect(result.value.entry).toEqual(cached);
    }
    expect(loadDiskCache(cachePath(), EntrySchema)).toEqual(cached);
  });

  it("errors when an unusable successful fetch has no matching usable stale cache", async () => {
    persistDiskCache(cachePath(), {
      payload: ["other-key"],
      fetchedAt: stale(),
      keyHash: "OTHER",
    } satisfies Entry);
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      value: { payload: [], fetchedAt: fresh(), keyHash: "MINE" } satisfies Entry,
    });
    const result = await withTtlAndFallback({
      path: cachePath(),
      schema: EntrySchema,
      ttlMs: ttl,
      fetcher,
      isCacheUsable: (c) => c.payload.length > 0,
      keyHashOf: (c) => c.keyHash,
      currentKeyHash: "MINE",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe("Fetched cache entry is unusable");
    expect(loadDiskCache(cachePath(), EntrySchema)?.payload).toEqual(["other-key"]);
  });

  it("falls back to a usable cache on fetch failure", async () => {
    persistDiskCache(cachePath(), { payload: ["usable"], fetchedAt: stale() } satisfies Entry);
    const fetcher = vi.fn().mockResolvedValue({ ok: false, error: { message: "down" } });
    const result = await withTtlAndFallback({
      path: cachePath(),
      schema: EntrySchema,
      ttlMs: ttl,
      fetcher,
      isCacheUsable: (c) => c.payload.length > 0,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.entry.payload).toEqual(["usable"]);
  });

  it("returns ok(entry) and warns when the post-fetch cache write fails", async () => {
    // A directory at the cache path makes the persist rename fail without touching
    // the in-hand fetched data: the request must still succeed.
    fs.mkdirSync(cachePath());
    const entry: Entry = { payload: ["live"], fetchedAt: fresh() };
    const fetcher = vi.fn().mockResolvedValue({ ok: true, value: entry });

    const result = await withTtlAndFallback({
      path: cachePath(),
      schema: EntrySchema,
      ttlMs: ttl,
      fetcher,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cached).toBe(false);
      expect(result.value.entry.payload).toEqual(["live"]);
    }
    expect(log).toHaveBeenCalledWith(
      "warn",
      "disk_cache_persist_failed",
      expect.objectContaining({ path: cachePath() }),
    );
  });
});
