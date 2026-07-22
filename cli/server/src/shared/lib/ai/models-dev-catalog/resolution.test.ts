import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ProviderModelsResponseSchema } from "@diffgazer/core/schemas/config";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const writeJsonFileSyncFailPaths = vi.hoisted(() => new Set<string>());

vi.mock("../../fs.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../fs.js")>();
  return {
    ...real,
    writeJsonFileSync: (filePath: string, data: unknown, mode?: number) => {
      if (writeJsonFileSyncFailPaths.has(filePath)) {
        const error = new Error("ENOSPC: no space left on device") as NodeJS.ErrnoException;
        error.code = "ENOSPC";
        throw error;
      }

      return real.writeJsonFileSync(filePath, data, mode);
    },
  };
});

import { requireValue } from "../../../../testing/assertions.js";
import { getProviderModels, ModelsDevCatalogCacheSchema } from "../models-dev-catalog.js";
import { MODELS_DEV_SAMPLE } from "../models-dev-sample.js";

const okResponse = (body: unknown, headers?: Record<string, string>): Response =>
  ({ ok: true, status: 200, headers: new Headers(headers), json: async () => body }) as Response;
const fresh = (): string => new Date().toISOString();
const stale = (): string => new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

let testHome: string;
const cachePath = (): string => path.join(testHome, "models-dev.json");
const writeCache = (catalog: unknown, fetchedAt: string, generationId?: string): void => {
  fs.writeFileSync(
    cachePath(),
    `${JSON.stringify({ catalog, fetchedAt, ...(generationId && { generationId }) }, null, 2)}\n`,
  );
};
const readCache = (): unknown => JSON.parse(fs.readFileSync(cachePath(), "utf-8"));
const catalogWithGoogleModel = (modelId: string): unknown => ({
  google: {
    id: "google",
    models: { [modelId]: { id: modelId, name: modelId } },
  },
});

beforeEach(() => {
  testHome = fs.mkdtempSync(path.join(os.tmpdir(), "dg-models-dev-"));
  process.env.DIFFGAZER_HOME = testHome;
  delete process.env.DIFFGAZER_OFFLINE;
  writeJsonFileSyncFailPaths.clear();
  vi.restoreAllMocks();
});
afterEach(() => {
  writeJsonFileSyncFailPaths.clear();
  delete process.env.DIFFGAZER_HOME;
  delete process.env.DIFFGAZER_OFFLINE;
  fs.rmSync(testHome, { recursive: true, force: true });
});

describe("getProviderModels — three-tier fallback", () => {
  it("live success: fetches, persists a valid round-tripping cache, tags source=live", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(MODELS_DEV_SAMPLE));
    const result = await getProviderModels("gemini");
    expect(result.source).toBe("live");
    expect(result.cached).toBe(false);
    expect(result.models.map((m) => m.id)).toContain("gemini-2.5-flash");

    // The persisted file must round-trip through the cache schema...
    const persisted = ModelsDevCatalogCacheSchema.safeParse(readCache());
    expect(persisted.success).toBe(true);
    if (!persisted.success) throw new Error("Expected a valid persisted models.dev cache");
    expect(persisted.data.generationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    // ...and a follow-up request must serve that fresh persisted cache without refetching.
    fetchSpy.mockClear();
    const followUp = await getProviderModels("gemini");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(followUp.source).toBe("cache");
    expect(followUp.models.map((m) => m.id)).toContain("gemini-2.5-flash");
  });

  it("uses every provider joining a flight when deciding whether to persist its catalog", async () => {
    const response = createDeferred<Response>();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockReturnValue(response.promise);
    const google =
      MODELS_DEV_SAMPLE !== null &&
      typeof MODELS_DEV_SAMPLE === "object" &&
      "google" in MODELS_DEV_SAMPLE
        ? MODELS_DEV_SAMPLE.google
        : undefined;

    const missingProviderRequest = getProviderModels("groq");
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const presentProviderRequest = getProviderModels("gemini");
    response.resolve(okResponse({ google: requireValue(google, "sample google provider") }));

    const [missingProvider, presentProvider] = await Promise.all([
      missingProviderRequest,
      presentProviderRequest,
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(missingProvider.source).toBe("snapshot");
    expect(presentProvider.source).toBe("live");
    expect(ModelsDevCatalogCacheSchema.safeParse(readCache()).success).toBe(true);
  });

  it("fresh disk cache: serves cache without fetching, source=cache", async () => {
    writeCache(MODELS_DEV_SAMPLE, fresh());
    const spy = vi.spyOn(globalThis, "fetch");
    const result = await getProviderModels("gemini");
    expect(spy).not.toHaveBeenCalled();
    expect(result.source).toBe("cache");
    expect(result.cached).toBe(true);
  });

  it("fetch fails with a stale disk cache: serves the stale cache, source=cache", async () => {
    writeCache(MODELS_DEV_SAMPLE, stale());
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const result = await getProviderModels("gemini");
    expect(result.source).toBe("cache");
    expect(result.models.map((m) => m.id)).toContain("gemini-2.5-flash");
  });

  it("no disk and fetch fails: falls back to the bundled snapshot, source=snapshot", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const result = await getProviderModels("gemini");
    expect(result.source).toBe("snapshot");
    expect(result.models.length).toBeGreaterThan(0);
  });

  it("coalesces concurrent catalog fetches and retries after a failed generation", async () => {
    const failedGeneration = createDeferred<Response>();
    const retryGeneration = createDeferred<Response>();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockReturnValueOnce(failedGeneration.promise)
      .mockReturnValueOnce(retryGeneration.promise);

    const failedRequests = Array.from({ length: 8 }, () => getProviderModels("gemini"));
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    failedGeneration.reject(new Error("network down"));

    const failedResults = await Promise.all(failedRequests);
    const failedBodies = failedResults.map((result) => ({
      source: result.source,
      ids: result.models.map(({ id }) => id),
    }));
    expect(failedResults.every((result) => result.source === "snapshot")).toBe(true);
    expect(new Set(failedBodies.map((body) => JSON.stringify(body))).size).toBe(1);

    const retryRequests = Array.from({ length: 8 }, () => getProviderModels("gemini"));
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    retryGeneration.resolve(
      okResponse({
        google: {
          id: "google",
          name: "Google",
          models: {
            "gemini-2.5-flash": {
              id: "gemini-2.5-flash",
              name: "Gemini 2.5 Flash",
              cost: { input: 0.3, output: 2.5 },
              limit: { context: 1_000_000 },
              tool_call: true,
            },
          },
        },
      }),
    );

    const retryResults = await Promise.all(retryRequests);
    expect(retryResults.every((result) => result.source === "live")).toBe(true);
    expect(new Set(retryResults.map((result) => JSON.stringify(result))).size).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("shrink-guarded live fetch with a stale cache baseline: serves the stale cache, not the snapshot", async () => {
    // Seed a non-zero baseline so the shrink-guard can actually trip.
    writeCache(MODELS_DEV_SAMPLE, stale());
    // A live payload with >0 models but far fewer than baseline*0.5 trips the shrink-guard.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse({ google: { id: "google", models: {} } }),
    );
    const result = await getProviderModels("gemini");
    expect(result.source).toBe("cache");
    expect(result.models.map((m) => m.id)).toContain("gemini-2.5-flash");
    // The shrunken live payload must NOT have overwritten the trusted cache.
    const persisted = readCache() as { catalog: Record<string, unknown> };
    expect(persisted.catalog.google).toBeDefined();
    expect(persisted.catalog.groq).toBeDefined();
  });

  it("empty live payload with no usable cache: falls back to the snapshot", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse({ google: { id: "google", models: {} } }),
    );
    const result = await getProviderModels("gemini");
    expect(result.source).toBe("snapshot");
    expect(result.models.length).toBeGreaterThan(0);
  });

  it("DIFFGAZER_OFFLINE: never fetches, serves cache when present", async () => {
    process.env.DIFFGAZER_OFFLINE = "1";
    writeCache(MODELS_DEV_SAMPLE, stale());
    const spy = vi.spyOn(globalThis, "fetch");
    const result = await getProviderModels("gemini");
    expect(spy).not.toHaveBeenCalled();
    expect(result.source).toBe("cache");
  });

  it("DIFFGAZER_OFFLINE with no cache: serves the snapshot, never fetches", async () => {
    process.env.DIFFGAZER_OFFLINE = "true";
    const spy = vi.spyOn(globalThis, "fetch");
    const result = await getProviderModels("gemini");
    expect(spy).not.toHaveBeenCalled();
    expect(result.source).toBe("snapshot");
  });

  it("returns a fetchedAt that satisfies the response contract's ISO datetime shape", async () => {
    // Date.parse accepts non-ISO strings ("2025/01/01", "December 17, 1995"); the
    // wire contract is z.iso.datetime(), so validate against that schema to catch
    // a parseable-but-non-ISO fetchedAt the looser Date.parse check would miss.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(MODELS_DEV_SAMPLE));
    const { fetchedAt } = await getProviderModels("gemini");
    expect(ProviderModelsResponseSchema.shape.fetchedAt.safeParse(fetchedAt).success).toBe(true);
  });

  it("a future-dated cache is not treated as fresh: it re-fetches rather than locking out refresh forever", async () => {
    // The cache is fully populated for gemini, so the only reason to leave the
    // fresh-cache tier is the freshness bound. A one-sided "now - time < TTL"
    // check reads a future timestamp as permanently fresh and never refreshes;
    // a bound that rejects future dates re-fetches and serves the live catalog.
    const future = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    writeCache(MODELS_DEV_SAMPLE, future);
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(MODELS_DEV_SAMPLE));
    const result = await getProviderModels("gemini");
    expect(spy).toHaveBeenCalled();
    expect(result.source).toBe("live");
    expect(result.models.map((m) => m.id)).toContain("gemini-2.5-flash");
  });

  it("serves a new cache generation after the on-disk cache is replaced", async () => {
    // Guards the per-generation parse memo: a second, distinct cache generation
    // (different fetchedAt and contents) must be reflected, never a stale memo.
    writeCache(MODELS_DEV_SAMPLE, fresh());
    const first = await getProviderModels("gemini");
    expect(first.models.map((m) => m.id)).toContain("gemini-2.5-flash");

    const { google, ...withoutGoogle } = MODELS_DEV_SAMPLE as Record<string, unknown>;
    writeCache(withoutGoogle, new Date(Date.now() + 1000).toISOString());
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const second = await getProviderModels("gemini");
    // The new generation lacks google, so the fresh-cache tier yields nothing for
    // gemini and resolution falls through to the snapshot — proving the memo did
    // not pin the prior generation's parse.
    expect(second.source).toBe("snapshot");
    expect(second.models.length).toBeGreaterThan(0);
  });

  it("serves replacement legacy contents when fetchedAt is unchanged", async () => {
    const fetchedAt = fresh();
    writeCache(catalogWithGoogleModel("first-model"), fetchedAt);
    expect((await getProviderModels("gemini")).models.map((model) => model.id)).toEqual([
      "first-model",
    ]);

    writeCache(catalogWithGoogleModel("second-model"), fetchedAt);
    expect((await getProviderModels("gemini")).models.map((model) => model.id)).toEqual([
      "second-model",
    ]);
  });

  it("scopes parsed cache generations to their cache path", async () => {
    const fetchedAt = fresh();
    const generationId = "4f9ec069-6874-4a91-8b4d-ceca1a5b3a94";
    const firstHome = path.join(testHome, "first");
    const secondHome = path.join(testHome, "second");
    fs.mkdirSync(firstHome, { recursive: true });
    fs.mkdirSync(secondHome, { recursive: true });
    fs.writeFileSync(
      path.join(firstHome, "models-dev.json"),
      `${JSON.stringify({ catalog: catalogWithGoogleModel("first-path"), fetchedAt, generationId })}\n`,
    );
    fs.writeFileSync(
      path.join(secondHome, "models-dev.json"),
      `${JSON.stringify({ catalog: catalogWithGoogleModel("second-path"), fetchedAt, generationId })}\n`,
    );

    process.env.DIFFGAZER_HOME = firstHome;
    expect((await getProviderModels("gemini")).models.map((model) => model.id)).toEqual([
      "first-path",
    ]);
    process.env.DIFFGAZER_HOME = secondHome;
    expect((await getProviderModels("gemini")).models.map((model) => model.id)).toEqual([
      "second-path",
    ]);
  });

  it("fresh cache missing the requested provider: never serves a blank picker, falls through to the snapshot", async () => {
    // A structurally-valid, fresh cache that simply lacks groq's source id. The
    // fresh-cache tier yields nothing for groq, so resolution falls through; with
    // the live fetch unavailable it must land on the bundled snapshot.
    const { groq, ...withoutGroq } = MODELS_DEV_SAMPLE as Record<string, unknown>;
    writeCache(withoutGroq, fresh());
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const result = await getProviderModels("groq");
    expect(result.source).toBe("snapshot");
    expect(result.models.length).toBeGreaterThan(0);
  });

  it("stale cache missing the requested provider with offline fetch: falls back to the snapshot", async () => {
    const { cerebras, ...withoutCerebras } = MODELS_DEV_SAMPLE as Record<string, unknown>;
    writeCache(withoutCerebras, stale());
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const result = await getProviderModels("cerebras");
    expect(result.source).toBe("snapshot");
    expect(result.models.length).toBeGreaterThan(0);
  });

  it("live fetch dropping one enabled provider: serves that provider from the trusted cache and does not overwrite it", async () => {
    // Trusted (stale) cache holds every sample provider, so a fetch is attempted.
    writeCache(MODELS_DEV_SAMPLE, stale());
    // Live payload is overall healthy but has dropped groq entirely.
    const { groq, ...withoutGroq } = MODELS_DEV_SAMPLE as Record<string, unknown>;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(withoutGroq));

    const result = await getProviderModels("groq");
    // The picker for groq must not be blank: it is served from the trusted cache.
    expect(result.models.length).toBeGreaterThan(0);
    expect(result.source).toBe("cache");

    // The provider-dropping payload must NOT have poisoned the on-disk cache.
    const persisted = readCache() as { catalog: Record<string, unknown> };
    expect(persisted.catalog.groq).toBeDefined();
  });

  it("live fetch dropping a provider while serving another: refuses to persist the poisoned catalog", async () => {
    // Trusted (stale) cache holds every sample provider; the requested provider
    // (gemini) is still present in the live payload, but groq was dropped.
    writeCache(MODELS_DEV_SAMPLE, stale());
    const { groq, ...withoutGroq } = MODELS_DEV_SAMPLE as Record<string, unknown>;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(withoutGroq));

    const result = await getProviderModels("gemini");
    expect(result.source).toBe("live");
    expect(result.models.length).toBeGreaterThan(0);

    // The dropped provider must survive in the on-disk cache: the trusted cache
    // is not overwritten by a catalog that loses an enabled provider.
    const persisted = readCache() as { catalog: Record<string, unknown> };
    expect(persisted.catalog.groq).toBeDefined();
  });

  it("disk-write failure on a live fetch: still serves the fetched models, never throws out of the request", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(MODELS_DEV_SAMPLE));
    writeJsonFileSyncFailPaths.add(cachePath());

    const result = await getProviderModels("gemini");
    expect(result.source).toBe("live");
    expect(result.models.map((m) => m.id)).toContain("gemini-2.5-flash");
    expect(fs.existsSync(cachePath())).toBe(false);
  });

  it("corrupt cache file present: quarantines it and uses the snapshot baseline to guard a degenerate live fetch", async () => {
    fs.writeFileSync(cachePath(), "{ this is not valid json");
    // A live payload with a single model is non-zero, so it would slip past a
    // baseline-of-zero shrink-guard (the first-run accept path). With the bundled
    // snapshot supplying the emergency baseline, the shrink-guard trips and the
    // half-populated catalog is rejected in favor of the snapshot.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse({
        google: {
          id: "google",
          models: { "gemini-2.5-flash": { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" } },
        },
      }),
    );
    const result = await getProviderModels("gemini");
    expect(result.models.length).toBeGreaterThan(0);
    expect(result.source).toBe("snapshot");
    // The corrupt file is quarantined (renamed), not left in place to keep failing.
    expect(fs.existsSync(cachePath())).toBe(false);
    expect(fs.readdirSync(testHome).some((f) => f.includes(".backup"))).toBe(true);
  });
});
