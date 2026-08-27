import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ProviderModelsResponseSchema } from "@diffgazer/core/schemas/config";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const POISONED_CATALOG_ENTRY = /github-models|xiaomi-mimo|gpt-4\.1|mimo-v2/;

const writeJsonFileSyncFailPaths = vi.hoisted(() => new Set<string>());

vi.mock("../fs.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../fs.js")>();
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

import {
  CATALOG_EMPTY_MODELS_REASON,
  LIVE_ONLY_MODEL_DESCRIPTION,
} from "@diffgazer/core/providers";
import { CANDIDATE_PRODUCT_IDS } from "@diffgazer/core/schemas/config";
import { requireValue } from "@diffgazer/core/testing/assertions";
import { MODELS_DEV_SAMPLE } from "../testing/models-dev-sample.js";
import { assertTempHome } from "../testing/temp-home.js";
import { LIVE_LIST_SHAPE_VERSION } from "./live-model-lists.js";
import * as modelsDevCatalog from "./models-dev-catalog.js";
import {
  catalogProviderModels,
  discoverConfigurationCatalog,
  ModelsDevCatalogCacheSchema,
  modelInfoFromBoundedObservation,
} from "./models-dev-catalog.js";

const okResponse = (body: unknown, headers?: Record<string, string>): Response =>
  ({ ok: true, status: 200, headers: new Headers(headers), json: async () => body }) as Response;
const fresh = (): string => new Date().toISOString();
const stale = (): string => new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

let testHome: string;
const cachePath = (): string => path.join(testHome, "models-dev.json");
const writeCache = (catalog: unknown, fetchedAt: string, etag?: string): void => {
  fs.writeFileSync(
    cachePath(),
    `${JSON.stringify({ catalog, fetchedAt, ...(etag && { etag }) }, null, 2)}\n`,
  );
};
const readCache = (): { catalog: Record<string, unknown>; fetchedAt: string; etag?: string } =>
  JSON.parse(fs.readFileSync(cachePath(), "utf-8"));
const modelListPath = (key: string): string => path.join(testHome, "model-lists", `${key}.json`);
const writeModelListCache = (key: string, models: unknown[]): void => {
  fs.mkdirSync(path.dirname(modelListPath(key)), { recursive: true });
  fs.writeFileSync(
    modelListPath(key),
    JSON.stringify({ models, fetchedAt: fresh(), shapeVersion: LIVE_LIST_SHAPE_VERSION }),
  );
};
// Every inline model declares structured output: the picker only offers models
// that do, so a fixture without it would be filtered out before the assertion.
const catalogWithGoogleModel = (modelId: string): unknown => ({
  google: {
    id: "google",
    models: { [modelId]: { id: modelId, name: modelId, structured_output: true } },
  },
});

beforeEach(() => {
  testHome = fs.mkdtempSync(path.join(os.tmpdir(), "dg-models-dev-"));
  assertTempHome(testHome);
  process.env.DIFFGAZER_HOME = testHome;
  delete process.env.DIFFGAZER_OFFLINE;
  writeJsonFileSyncFailPaths.clear();
  vi.restoreAllMocks();
});
// One test re-points DIFFGAZER_HOME at nested homes mid-test; both stay inside testHome,
// and `catalogProviderModels.get` awaits its cache writes, so removing testHome before dropping the
// variable is enough. `paths.ts` re-reads it per call, so the reverse order would aim any
// still-pending work at the real ~/.diffgazer.
afterEach(() => {
  writeJsonFileSyncFailPaths.clear();
  fs.rmSync(testHome, { recursive: true, force: true });
  delete process.env.DIFFGAZER_HOME;
  delete process.env.DIFFGAZER_OFFLINE;
});

describe("catalogProviderModels.get — three-tier fallback", () => {
  it("live success: fetches, persists a valid round-tripping cache, tags source=live", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(MODELS_DEV_SAMPLE));
    const result = await catalogProviderModels.get("gemini");
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
    const followUp = await catalogProviderModels.get("gemini");
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

    const missingProviderRequest = catalogProviderModels.get("openrouter");
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const presentProviderRequest = catalogProviderModels.get("gemini");
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
    const result = await catalogProviderModels.get("gemini");
    expect(spy).not.toHaveBeenCalled();
    expect(result.source).toBe("cache");
    expect(result.cached).toBe(true);
  });

  it("a cache older than an hour is stale: refetches instead of serving it", async () => {
    writeCache(MODELS_DEV_SAMPLE, new Date(Date.now() - 90 * 60 * 1000).toISOString());
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(MODELS_DEV_SAMPLE));
    const result = await catalogProviderModels.get("gemini");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.source).toBe("live");
  });

  it("persists the models.dev ETag with a live catalog", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse(MODELS_DEV_SAMPLE, { etag: '"catalog-v1"' }),
    );
    await catalogProviderModels.get("gemini");
    expect(readCache().etag).toBe('"catalog-v1"');
  });

  it("revalidates a stale cache with If-None-Match: a 304 keeps the catalog and bumps fetchedAt", async () => {
    const before = Date.now();
    writeCache(MODELS_DEV_SAMPLE, stale(), '"catalog-v1"');
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: false, status: 304, headers: new Headers() } as Response);

    const result = await catalogProviderModels.get("gemini");

    const [, init] = requireValue(spy.mock.calls[0], "fetch call");
    expect((init as RequestInit).headers).toEqual({ "if-none-match": '"catalog-v1"' });
    expect(result.source).toBe("cache");
    expect(result.models.map((m) => m.id)).toContain("gemini-2.5-flash");
    expect(Date.parse(result.fetchedAt)).toBeGreaterThanOrEqual(before);
    const persisted = readCache();
    expect(persisted.etag).toBe('"catalog-v1"');
    expect(persisted.catalog.google).toBeDefined();
    expect(Date.parse(persisted.fetchedAt)).toBeGreaterThanOrEqual(before);

    // The revalidated cache is fresh again: the next read serves it without a request.
    spy.mockClear();
    const followUp = await catalogProviderModels.get("gemini");
    expect(spy).not.toHaveBeenCalled();
    expect(followUp.source).toBe("cache");
  });

  it("fetch fails with a stale disk cache: serves the stale cache, source=cache", async () => {
    writeCache(MODELS_DEV_SAMPLE, stale());
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const result = await catalogProviderModels.get("gemini");
    expect(result.source).toBe("cache");
    expect(result.models.map((m) => m.id)).toContain("gemini-2.5-flash");
  });

  it("no disk and fetch fails: falls back to the bundled snapshot, source=snapshot", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const result = await catalogProviderModels.get("gemini");
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

    const failedRequests = Array.from({ length: 8 }, () => catalogProviderModels.get("gemini"));
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    failedGeneration.reject(new Error("network down"));

    const failedResults = await Promise.all(failedRequests);
    const failedBodies = failedResults.map((result) => ({
      source: result.source,
      ids: result.models.map(({ id }) => id),
    }));
    expect(failedResults.every((result) => result.source === "snapshot")).toBe(true);
    expect(new Set(failedBodies.map((body) => JSON.stringify(body))).size).toBe(1);

    const retryRequests = Array.from({ length: 8 }, () => catalogProviderModels.get("gemini"));
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
              structured_output: true,
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
    const result = await catalogProviderModels.get("gemini");
    expect(result.source).toBe("cache");
    expect(result.models.map((m) => m.id)).toContain("gemini-2.5-flash");
    // The shrunken live payload must NOT have overwritten the trusted cache.
    const persisted = readCache();
    expect(persisted.catalog.google).toBeDefined();
    expect(persisted.catalog.openrouter).toBeDefined();
  });

  it("empty live payload with no usable cache: falls back to the snapshot", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse({ google: { id: "google", models: {} } }),
    );
    const result = await catalogProviderModels.get("gemini");
    expect(result.source).toBe("snapshot");
    expect(result.models.length).toBeGreaterThan(0);
  });

  it("DIFFGAZER_OFFLINE: never fetches, serves cache when present", async () => {
    process.env.DIFFGAZER_OFFLINE = "1";
    writeCache(MODELS_DEV_SAMPLE, stale());
    const spy = vi.spyOn(globalThis, "fetch");
    const result = await catalogProviderModels.get("gemini");
    expect(spy).not.toHaveBeenCalled();
    expect(result.source).toBe("cache");
  });

  it("DIFFGAZER_OFFLINE with no cache: serves the snapshot, never fetches", async () => {
    process.env.DIFFGAZER_OFFLINE = "true";
    const spy = vi.spyOn(globalThis, "fetch");
    const result = await catalogProviderModels.get("gemini");
    expect(spy).not.toHaveBeenCalled();
    expect(result.source).toBe("snapshot");
  });

  it("returns a fetchedAt that satisfies the response contract's ISO datetime shape", async () => {
    // Date.parse accepts non-ISO strings ("2025/01/01", "December 17, 1995"); the
    // wire contract is z.iso.datetime(), so validate against that schema to catch
    // a parseable-but-non-ISO fetchedAt the looser Date.parse check would miss.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(MODELS_DEV_SAMPLE));
    const response = await catalogProviderModels.get("gemini");
    expect(ProviderModelsResponseSchema.safeParse(response).success).toBe(true);
  });

  it("a future-dated cache is not treated as fresh: it re-fetches rather than locking out refresh forever", async () => {
    // The cache is fully populated for gemini, so the only reason to leave the
    // fresh-cache tier is the freshness bound. A one-sided "now - time < TTL"
    // check reads a future timestamp as permanently fresh and never refreshes;
    // a bound that rejects future dates re-fetches and serves the live catalog.
    const future = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    writeCache(MODELS_DEV_SAMPLE, future);
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(MODELS_DEV_SAMPLE));
    const result = await catalogProviderModels.get("gemini");
    expect(spy).toHaveBeenCalled();
    expect(result.source).toBe("live");
    expect(result.models.map((m) => m.id)).toContain("gemini-2.5-flash");
  });

  it("serves a new cache generation after the on-disk cache is replaced", async () => {
    // Guards the per-generation parse memo: a second, distinct cache generation
    // (different fetchedAt and contents) must be reflected, never a stale memo.
    writeCache(MODELS_DEV_SAMPLE, fresh());
    const first = await catalogProviderModels.get("gemini");
    expect(first.models.map((m) => m.id)).toContain("gemini-2.5-flash");

    const { google, ...withoutGoogle } = MODELS_DEV_SAMPLE as Record<string, unknown>;
    writeCache(withoutGoogle, new Date(Date.now() + 1000).toISOString());
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const second = await catalogProviderModels.get("gemini");
    // The new generation lacks google, so the fresh-cache tier yields nothing for
    // gemini and resolution falls through to the snapshot — proving the memo did
    // not pin the prior generation's parse.
    expect(second.source).toBe("snapshot");
    expect(second.models.length).toBeGreaterThan(0);
  });

  it("serves replacement legacy contents when fetchedAt is unchanged", async () => {
    const fetchedAt = fresh();
    writeCache(catalogWithGoogleModel("first-model"), fetchedAt);
    expect((await catalogProviderModels.get("gemini")).models.map((model) => model.id)).toEqual([
      "first-model",
    ]);

    writeCache(catalogWithGoogleModel("second-model"), fetchedAt);
    expect((await catalogProviderModels.get("gemini")).models.map((model) => model.id)).toEqual([
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
    expect((await catalogProviderModels.get("gemini")).models.map((model) => model.id)).toEqual([
      "first-path",
    ]);
    process.env.DIFFGAZER_HOME = secondHome;
    expect((await catalogProviderModels.get("gemini")).models.map((model) => model.id)).toEqual([
      "second-path",
    ]);
  });

  it("fresh cache missing the requested provider: never serves a blank picker, falls through to the snapshot", async () => {
    // A structurally-valid, fresh cache that simply lacks openrouter's source id. The
    // fresh-cache tier yields nothing for openrouter, so resolution falls through; with
    // the live fetch unavailable it must land on the bundled snapshot.
    const { openrouter, ...withoutOpenrouter } = MODELS_DEV_SAMPLE as Record<string, unknown>;
    writeCache(withoutOpenrouter, fresh());
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const result = await catalogProviderModels.get("openrouter");
    expect(result.source).toBe("snapshot");
    expect(result.models.length).toBeGreaterThan(0);
  });

  it("stale cache missing the requested provider with offline fetch: falls back to the snapshot", async () => {
    const { zai, ...withoutZai } = MODELS_DEV_SAMPLE as Record<string, unknown>;
    writeCache(withoutZai, stale());
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const result = await catalogProviderModels.get("zai");
    expect(result.source).toBe("snapshot");
    expect(result.models.length).toBeGreaterThan(0);
  });

  it("live fetch dropping one overlay-populated provider: serves that provider from the trusted cache and does not overwrite it", async () => {
    // Trusted (stale) cache holds every sample provider, so a fetch is attempted.
    writeCache(MODELS_DEV_SAMPLE, stale());
    // Live payload is overall healthy but has dropped openrouter entirely.
    const { openrouter, ...withoutOpenrouter } = MODELS_DEV_SAMPLE as Record<string, unknown>;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(withoutOpenrouter));

    const result = await catalogProviderModels.get("openrouter");
    // The picker for openrouter must not be blank: it is served from the trusted cache.
    expect(result.models.length).toBeGreaterThan(0);
    expect(result.source).toBe("cache");

    // The provider-dropping payload must NOT have poisoned the on-disk cache.
    const persisted = readCache();
    expect(persisted.catalog.openrouter).toBeDefined();
  });

  it("live fetch dropping a provider while serving another: refuses to persist the poisoned catalog", async () => {
    // Trusted (stale) cache holds every sample provider; the requested provider
    // (gemini) is still present in the live payload, but openrouter was dropped.
    writeCache(MODELS_DEV_SAMPLE, stale());
    const { openrouter, ...withoutOpenrouter } = MODELS_DEV_SAMPLE as Record<string, unknown>;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(withoutOpenrouter));

    const result = await catalogProviderModels.get("gemini");
    expect(result.source).toBe("live");
    expect(result.models.length).toBeGreaterThan(0);

    // The dropped provider must survive in the on-disk cache: the trusted cache
    // is not overwritten by a catalog that loses an overlay-populated provider.
    const persisted = readCache();
    expect(persisted.catalog.openrouter).toBeDefined();
  });

  it("disk-write failure on a live fetch: still serves the fetched models, never throws out of the request", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(MODELS_DEV_SAMPLE));
    writeJsonFileSyncFailPaths.add(cachePath());

    const result = await catalogProviderModels.get("gemini");
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
          models: {
            "gemini-2.5-flash": {
              id: "gemini-2.5-flash",
              name: "Gemini 2.5 Flash",
              structured_output: true,
            },
          },
        },
      }),
    );
    const result = await catalogProviderModels.get("gemini");
    expect(result.models.length).toBeGreaterThan(0);
    expect(result.source).toBe("snapshot");
    // The corrupt file is quarantined (renamed), not left in place to keep failing.
    expect(fs.existsSync(cachePath())).toBe(false);
    expect(fs.readdirSync(testHome).some((f) => f.includes(".backup"))).toBe(true);
  });
});

const OPENROUTER_CATALOG = {
  openrouter: {
    id: "openrouter",
    models: {
      "openai/gpt-oss-20b": {
        id: "openai/gpt-oss-20b",
        name: "OpenAI: gpt-oss-20b (catalog)",
        cost: { input: 0.04, output: 0.15 },
        limit: { context: 131072, output: 32768 },
        structured_output: true,
        release_date: "2025-08-05",
      },
      // Declares no structured output. OpenRouter is a pinned-downstream-route
      // product, so the declared refusal does not withhold the row: the gateway
      // drops an unsupported response_format instead of rejecting the request,
      // and local validation covers the rest.
      "google/gemma-3-27b-it": {
        id: "google/gemma-3-27b-it",
        name: "Google: Gemma 3 27B",
        cost: { input: 0.1, output: 0.2 },
        structured_output: false,
      },
      // The catalog believes it returns structured output; OpenRouter's own
      // list says the route does not enforce it. The row is still offered.
      "mistralai/mistral-small": {
        id: "mistralai/mistral-small",
        name: "Mistral: Mistral Small",
        cost: { input: 0.2, output: 0.6 },
        structured_output: true,
      },
      // No longer in the live list: the provider stopped serving it.
      "anthropic/claude-3-haiku": {
        id: "anthropic/claude-3-haiku",
        name: "Anthropic: Claude 3 Haiku",
        cost: { input: 0.25, output: 1.25 },
        structured_output: true,
      },
    },
  },
};

const OPENROUTER_MODEL_LIST = {
  data: [
    {
      id: "openai/gpt-oss-20b",
      name: "OpenAI: gpt-oss-20b",
      pricing: { prompt: "0.00000004", completion: "0.00000015" },
      context_length: 131072,
      supported_parameters: ["response_format", "structured_outputs", "tools"],
      created: 1754352000,
    },
    {
      id: "z-ai/glm-5.2:free",
      name: "Z.AI: GLM 5.2 (free)",
      pricing: { prompt: "0", completion: "0" },
      context_length: 202752,
      supported_parameters: ["response_format", "structured_outputs", "tools"],
      created: 1755216000,
    },
    {
      id: "google/gemma-3-27b-it",
      name: "Google: Gemma 3 27B",
      pricing: { prompt: "0.0000001", completion: "0.0000002" },
      context_length: 131072,
      supported_parameters: ["tools"],
    },
    {
      id: "mistralai/mistral-small",
      name: "Mistral: Mistral Small",
      pricing: { prompt: "0.0000002", completion: "0.0000006" },
      context_length: 32768,
      supported_parameters: ["response_format", "tools"],
    },
    {
      id: "meta-llama/llama-guard-4-12b",
      name: "Meta: Llama Guard 4 12B",
      pricing: { prompt: "0.00000018", completion: "0.00000018" },
      context_length: 163840,
      supported_parameters: ["tools"],
    },
    { id: "openrouter/auto", name: "Auto Router", pricing: { prompt: "-1", completion: "-1" } },
    {
      id: "z-ai/glm-5.3",
      name: "Z.AI: GLM 5.3",
      context_length: 202752,
      supported_parameters: ["structured_outputs"],
    },
  ],
};

const OLLAMA_CLOUD_CATALOG = {
  "ollama-cloud": {
    id: "ollama-cloud",
    models: {
      "gpt-oss:20b": { id: "gpt-oss:20b", name: "GPT-OSS 20B", limit: { context: 131072 } },
      "kimi-k2:1t": { id: "kimi-k2:1t", name: "Kimi K2" },
    },
  },
};

const ZAI_CATALOG = {
  zai: {
    id: "zai",
    models: {
      "glm-5.2": {
        id: "glm-5.2",
        name: "GLM-5.2",
        cost: { input: 1, output: 3.2 },
        limit: { context: 200000 },
        structured_output: true,
      },
    },
  },
  "zai-coding-plan": {
    id: "zai-coding-plan",
    models: {
      "glm-5.3": {
        id: "glm-5.3",
        name: "GLM-5.3",
        cost: { input: 0, output: 0 },
        limit: { context: 200000 },
        structured_output: true,
      },
    },
  },
};

const ZEN_CATALOG = {
  opencode: {
    id: "opencode",
    models: {
      "deepseek-v4-pro": {
        id: "deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        cost: { input: 1.74, output: 3.84 },
        limit: { context: 131072 },
        structured_output: true,
        release_date: "2025-12-01",
      },
      "nemotron-3-ultra-free": {
        id: "nemotron-3-ultra-free",
        name: "Nemotron 3 Ultra (free)",
        cost: { input: 0, output: 0 },
        limit: { context: 262144 },
        structured_output: true,
      },
    },
  },
  "opencode-go": {
    id: "opencode-go",
    models: {
      "glm-5.3": {
        id: "glm-5.3",
        name: "GLM-5.3",
        cost: { input: 0.6, output: 2.2 },
        limit: { context: 200000 },
        structured_output: true,
      },
    },
  },
};

const MINIMAX_CATALOG = {
  minimax: {
    id: "minimax",
    models: {
      "MiniMax-M2.7": {
        id: "MiniMax-M2.7",
        name: "MiniMax M2.7",
        cost: { input: 0.3, output: 1.2 },
        limit: { context: 204800 },
        structured_output: true,
      },
    },
  },
};

const OLLAMA_CLOUD_MODEL_LIST = {
  object: "list",
  data: [
    { id: "gpt-oss:20b", object: "model", created: 1754352000, owned_by: "ollama" },
    { id: "glm-5.2", object: "model", created: 1755216000, owned_by: "ollama" },
  ],
};

describe("live provider model lists", () => {
  const listFetch = (url: string, body: unknown) =>
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input) === url) return okResponse(body);
      throw new Error(`unexpected fetch ${String(input)}`);
    });

  it("merges OpenRouter's public list over the catalog: live ids, catalog rows where known", async () => {
    writeCache(OPENROUTER_CATALOG, fresh());
    const spy = listFetch("https://openrouter.ai/api/v1/models", OPENROUTER_MODEL_LIST);

    const result = await discoverConfigurationCatalog({
      configurationId: "cfg-openrouter",
      productId: "openrouter",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const [, init] = requireValue(spy.mock.calls[0], "list fetch");
    expect((init as RequestInit).headers).toEqual({});
    expect((init as RequestInit).redirect).toBe("error");
    expect(result.status).toBe("passed");
    if (result.status !== "passed") return;
    expect(result.source).toBe("provider-live");
    expect(result.cached).toBe(false);
    expect(
      ProviderModelsResponseSchema.safeParse({
        models: result.models,
        fetchedAt: result.fetchedAt,
        source: result.source,
        cached: result.cached,
      }).success,
    ).toBe(true);
    expect(result.models).toEqual([
      // Known to the catalog: its row (dated, so it sorts before the dateless
      // live-only rows), not the live metadata.
      {
        id: "openai/gpt-oss-20b",
        name: "OpenAI: gpt-oss-20b (catalog)",
        description: "131K context",
        tier: "paid",
        releaseDate: "2025-08-05",
      },
      // Live-only: name, zero price, and context from the list; no release
      // date, so the provider's own list order is preserved.
      {
        id: "z-ai/glm-5.2:free",
        name: "Z.AI: GLM 5.2 (free)",
        description: "203K context",
        tier: "free",
      },
      // Declared structured-output refusals on this pinned-downstream-route
      // product: the catalog rows are served, not withheld.
      {
        id: "google/gemma-3-27b-it",
        name: "Google: Gemma 3 27B",
        description: "",
        tier: "paid",
      },
      {
        id: "mistralai/mistral-small",
        name: "Mistral: Mistral Small",
        description: "",
        tier: "paid",
      },
      // Live-only without structured_outputs in supported_parameters: offered
      // with the list's own metadata.
      {
        id: "meta-llama/llama-guard-4-12b",
        name: "Meta: Llama Guard 4 12B",
        description: "164K context",
        tier: "paid",
      },
      // Live-only without a price: the context stays, the row says the price is unknown.
      {
        id: "z-ai/glm-5.3",
        name: "Z.AI: GLM 5.3",
        description: "203K context · pricing unknown",
        tier: "unknown",
      },
    ]);
    expect(fs.existsSync(modelListPath("openrouter"))).toBe(true);
  });

  it("requests the provider list and models.dev concurrently on a cold open", async () => {
    const listResponse = createDeferred<Response>();
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input) === "https://openrouter.ai/api/v1/models") return listResponse.promise;
      return okResponse(OPENROUTER_CATALOG);
    });

    const discovery = discoverConfigurationCatalog({
      configurationId: "cfg-openrouter",
      productId: "openrouter",
    });
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    listResponse.resolve(okResponse(OPENROUTER_MODEL_LIST));

    const result = await discovery;
    expect(result.status === "passed" && result.source).toBe("provider-live");
  });

  it("serves the list from its five-minute cache without a second request", async () => {
    writeCache(OPENROUTER_CATALOG, fresh());
    const spy = listFetch("https://openrouter.ai/api/v1/models", OPENROUTER_MODEL_LIST);
    const tuple = { configurationId: "cfg-openrouter", productId: "openrouter" } as const;

    await discoverConfigurationCatalog(tuple);
    const second = await discoverConfigurationCatalog(tuple);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(second.status).toBe("passed");
    if (second.status === "passed") {
      expect(second.source).toBe("provider-cache");
      expect(second.cached).toBe(true);
    }
  });

  it("merges Z.AI's key-bearing list: a live-only id borrows the coding plan's name, never its price", async () => {
    writeCache(ZAI_CATALOG, fresh());
    // The configuration-keyed cache holds what the OpenAI-standard `{ data: [{ id, object, owned_by }] }`
    // list parses to (see live-model-lists.test.ts), so no credential is read here.
    writeModelListCache("configuration-cfg-zai", [
      { id: "glm-5.2", tier: "unknown" },
      { id: "glm-5.3", tier: "unknown" },
    ]);
    const spy = vi.spyOn(globalThis, "fetch");

    const result = await discoverConfigurationCatalog({
      configurationId: "cfg-zai",
      productId: "zai",
    });

    expect(spy).not.toHaveBeenCalled();
    expect(result.status).toBe("passed");
    if (result.status !== "passed") return;
    expect(result.source).toBe("provider-cache");
    expect(result.models).toEqual([
      { id: "glm-5.2", name: "GLM-5.2", description: "200K context", tier: "paid" },
      { id: "glm-5.3", name: "GLM-5.3", description: LIVE_ONLY_MODEL_DESCRIPTION, tier: "unknown" },
    ]);
  });

  it("offers a declared structured-output refusal on the snapshot tier: OpenRouter routes are not withheld", async () => {
    // models.dev is out of reach and no cache exists, so the bundled snapshot is
    // the catalog. OpenRouter's list names a model the snapshot marks as
    // declining structured output; on this pinned-downstream-route product the
    // declared refusal does not withhold the row, so the catalog row is served
    // with its own tier.
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    writeModelListCache("openrouter", [
      { id: "meta-llama/llama-guard-4-12b", tier: "unknown" },
      { id: "meta-llama/llama-4-scout", tier: "unknown" },
    ]);

    const result = await discoverConfigurationCatalog({
      configurationId: "cfg-openrouter-withheld",
      productId: "openrouter",
    });

    expect(result.status).toBe("passed");
    if (result.status !== "passed") return;
    expect(result.source).toBe("provider-cache");
    // Newest release first; the declared-refusal row leads with the catalog's
    // own paid tier, proving it is the catalog row and not a live-only stub.
    expect(result.models.map((model) => model.id)).toEqual([
      "meta-llama/llama-guard-4-12b",
      "meta-llama/llama-4-scout",
    ]);
    expect(result.models[0]?.tier).toBe("paid");
  });

  it("merges Ollama Cloud's public list: live-only ids show as name=id with an unknown tier", async () => {
    writeCache(OLLAMA_CLOUD_CATALOG, fresh());
    listFetch("https://ollama.com/v1/models", OLLAMA_CLOUD_MODEL_LIST);

    const result = await discoverConfigurationCatalog({
      configurationId: "cfg-ollama-cloud",
      productId: "ollama-cloud",
    });

    expect(result.status).toBe("passed");
    if (result.status !== "passed") return;
    expect(result.source).toBe("provider-live");
    // No row carries a release date, so the provider's list order stands.
    expect(result.models).toEqual([
      { id: "gpt-oss:20b", name: "GPT-OSS 20B", description: "131K context", tier: "unknown" },
      { id: "glm-5.2", name: "glm-5.2", description: LIVE_ONLY_MODEL_DESCRIPTION, tier: "unknown" },
    ]);
  });

  it("degrades silently to the catalog when the list request fails", async () => {
    writeCache(OPENROUTER_CATALOG, fresh());
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("openrouter down"));

    const result = await discoverConfigurationCatalog({
      configurationId: "cfg-openrouter",
      productId: "openrouter",
    });

    expect(result.status).toBe("passed");
    if (result.status !== "passed") return;
    expect(result.source).toBe("cache");
    // The dated row leads; the dateless rows follow in catalog order.
    expect(result.models.map((model) => model.id)).toEqual([
      "openai/gpt-oss-20b",
      "anthropic/claude-3-haiku",
      "google/gemma-3-27b-it",
      "mistralai/mistral-small",
    ]);
  });

  it("degrades to the catalog, caching nothing, when the response is not a model list", async () => {
    writeCache(OPENROUTER_CATALOG, fresh());
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse({ error: "rate limited" }));

    const result = await discoverConfigurationCatalog({
      configurationId: "cfg-openrouter",
      productId: "openrouter",
    });

    expect(result.status === "passed" && result.source).toBe("cache");
    expect(fs.existsSync(modelListPath("openrouter"))).toBe(false);
  });

  it("degrades to the catalog when the list names only ids the product policy rejects", async () => {
    writeCache(OPENROUTER_CATALOG, fresh());
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okResponse({ data: [{ id: "openrouter/auto" }, { id: "openrouter/free" }] }),
    );

    const result = await discoverConfigurationCatalog({
      configurationId: "cfg-openrouter",
      productId: "openrouter",
    });

    expect(result.status).toBe("passed");
    if (result.status !== "passed") return;
    expect(result.source).toBe("cache");
    expect(result.models.map((model) => model.id)).toEqual([
      "openai/gpt-oss-20b",
      "anthropic/claude-3-haiku",
      "google/gemma-3-27b-it",
      "mistralai/mistral-small",
    ]);
  });

  it("DIFFGAZER_OFFLINE: never requests a provider list", async () => {
    process.env.DIFFGAZER_OFFLINE = "1";
    writeCache(OPENROUTER_CATALOG, fresh());
    const spy = vi.spyOn(globalThis, "fetch");

    const result = await discoverConfigurationCatalog({
      configurationId: "cfg-openrouter",
      productId: "openrouter",
    });

    expect(spy).not.toHaveBeenCalled();
    expect(result.status === "passed" && result.source).toBe("cache");
  });

  it("merges OpenCode Zen's key-bearing list over the models.dev catalog: live ids, catalog pricing", async () => {
    // Zen's live `/models` list carries ids only — no names, prices, or limits —
    // so the models.dev `opencode`/`opencode-go` sources dress every id they
    // know. The configuration-keyed cache stands in for a successful
    // key-bearing fetch, as in the Z.AI test above. A stealth route the catalog
    // has never seen stays an honest live-only row.
    writeCache(ZEN_CATALOG, fresh());
    writeModelListCache("configuration-cfg-zen", [
      { id: "nemotron-3-ultra-free", tier: "unknown" },
      { id: "deepseek-v4-pro", tier: "unknown" },
      { id: "hy3-preview", tier: "unknown" },
    ]);
    const spy = vi.spyOn(globalThis, "fetch");

    const result = await discoverConfigurationCatalog({
      configurationId: "cfg-zen",
      productId: "opencode-zen",
    });

    expect(spy).not.toHaveBeenCalled();
    expect(result.status).toBe("passed");
    if (result.status !== "passed") return;
    expect(result.source).toBe("provider-cache");
    expect(result.cached).toBe(true);
    expect(result.models).toEqual([
      // Known to the catalog: its row (dated, so it leads), with the real tier.
      {
        id: "deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        description: "131K context",
        tier: "paid",
        releaseDate: "2025-12-01",
      },
      // Zero-cost per the catalog: earns the FREE tier the bare list never could.
      {
        id: "nemotron-3-ultra-free",
        name: "Nemotron 3 Ultra (free)",
        description: "262K context",
        tier: "free",
      },
      // Uncatalogued stealth route: live-only row, honest about the unknown price.
      {
        id: "hy3-preview",
        name: "hy3-preview",
        description: LIVE_ONLY_MODEL_DESCRIPTION,
        tier: "unknown",
      },
    ]);
  });

  it("degrades OpenCode Zen to the catalog when no live list can be fetched", async () => {
    // No cached list and no stored configuration credential: the live fetch
    // cannot happen. The models.dev union (`opencode` + `opencode-go`) fills
    // the picker instead of a skip — the zai idiom.
    writeCache(ZEN_CATALOG, fresh());
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("zen down"));

    const result = await discoverConfigurationCatalog({
      configurationId: "cfg-zen",
      productId: "opencode-zen",
    });

    expect(result.status).toBe("passed");
    if (result.status !== "passed") return;
    expect(result.source).toBe("cache");
    // The dated row leads; the dateless union rows follow in catalog order,
    // proving the Go source contributes to the fallback.
    expect(result.models.map((model) => model.id)).toEqual([
      "deepseek-v4-pro",
      "glm-5.3",
      "nemotron-3-ultra-free",
    ]);
  });

  it("DIFFGAZER_OFFLINE: serves OpenCode Zen from the catalog, never fetches", async () => {
    process.env.DIFFGAZER_OFFLINE = "1";
    writeCache(ZEN_CATALOG, fresh());
    const spy = vi.spyOn(globalThis, "fetch");

    const result = await discoverConfigurationCatalog({
      configurationId: "cfg-zen",
      productId: "opencode-zen",
    });

    expect(spy).not.toHaveBeenCalled();
    expect(result.status === "passed" && result.source).toBe("cache");
  });

  it("merges MiniMax's key-bearing list over the models.dev catalog: live ids, catalog pricing", async () => {
    // The configuration-keyed cache stands in for a successful key-bearing
    // `{endpoint}/models` fetch, as in the Z.AI test above. Ids are
    // case-preserved (`MiniMax-M2.7`); a live-only id the catalog has never
    // seen stays an honest live-only row.
    writeCache(MINIMAX_CATALOG, fresh());
    writeModelListCache("configuration-cfg-minimax", [
      { id: "MiniMax-M2.7", tier: "unknown" },
      { id: "MiniMax-M3", tier: "unknown" },
    ]);
    const spy = vi.spyOn(globalThis, "fetch");

    const result = await discoverConfigurationCatalog({
      configurationId: "cfg-minimax",
      productId: "minimax",
    });

    expect(spy).not.toHaveBeenCalled();
    expect(result.status).toBe("passed");
    if (result.status !== "passed") return;
    expect(result.source).toBe("provider-cache");
    expect(result.models).toEqual([
      // Known to the catalog: its row, with models.dev pricing → paid tier.
      { id: "MiniMax-M2.7", name: "MiniMax M2.7", description: "205K context", tier: "paid" },
      // Uncatalogued live id: live-only row, honest about the unknown price.
      {
        id: "MiniMax-M3",
        name: "MiniMax-M3",
        description: LIVE_ONLY_MODEL_DESCRIPTION,
        tier: "unknown",
      },
    ]);
  });

  it("degrades MiniMax to the catalog when no live list can be fetched", async () => {
    // No cached list and no stored configuration credential: the live fetch
    // cannot happen. The models.dev rows fill the picker instead of a skip —
    // the zai idiom. A `/models` 404 lands on this same path.
    writeCache(MINIMAX_CATALOG, fresh());
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("minimax down"));

    const result = await discoverConfigurationCatalog({
      configurationId: "cfg-minimax",
      productId: "minimax",
    });

    expect(result.status).toBe("passed");
    if (result.status !== "passed") return;
    expect(result.source).toBe("cache");
    expect(result.models.map((model) => model.id)).toEqual(["MiniMax-M2.7"]);
  });

  it("merges Gemini's key-bearing list: live ids prune the catalog, live-only ids are excluded", async () => {
    // The configuration-keyed cache holds what the OpenAI-compat list parses to
    // after the `models/` prefix strip (see live-model-lists.test.ts). Gemini's
    // compat list also names embeddings/tts/imagen routes the catalog has never
    // seen; those live-only ids must not surface as "pricing unknown" rows.
    writeCache(
      {
        google: {
          id: "google",
          models: {
            "gemini-2.5-flash": {
              id: "gemini-2.5-flash",
              name: "Gemini 2.5 Flash",
              cost: { input: 0.3, output: 2.5 },
              limit: { context: 1048576 },
              structured_output: true,
            },
            "gemini-2.5-pro": {
              id: "gemini-2.5-pro",
              name: "Gemini 2.5 Pro",
              cost: { input: 1.25, output: 10 },
              limit: { context: 1048576 },
              structured_output: true,
            },
          },
        },
      },
      fresh(),
    );
    writeModelListCache("configuration-cfg-gemini", [
      { id: "gemini-2.5-flash", tier: "unknown" },
      { id: "text-embedding-004", tier: "unknown" },
    ]);
    const spy = vi.spyOn(globalThis, "fetch");

    const result = await discoverConfigurationCatalog({
      configurationId: "cfg-gemini",
      productId: "gemini",
    });

    expect(spy).not.toHaveBeenCalled();
    expect(result.status).toBe("passed");
    if (result.status !== "passed") return;
    expect(result.source).toBe("provider-cache");
    // The pro row the live list no longer names is pruned; the embedding route
    // the catalog never knew is excluded rather than offered.
    expect(result.models).toEqual([
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        description: "1M context",
        tier: "paid",
      },
    ]);
  });

  it("degrades Gemini to the catalog when no live list can be fetched", async () => {
    writeCache(MODELS_DEV_SAMPLE, fresh());
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("gemini down"));

    const result = await discoverConfigurationCatalog({
      configurationId: "cfg-gemini",
      productId: "gemini",
    });

    expect(result.status).toBe("passed");
    if (result.status !== "passed") return;
    expect(result.source).toBe("cache");
    expect(result.models.length).toBeGreaterThan(0);
  });
});

describe("newest-first model ordering", () => {
  it("orders picker rows by release date descending, ties by id, dateless rows last in catalog order", async () => {
    writeCache(
      {
        google: {
          id: "google",
          models: {
            older: {
              id: "older",
              name: "Older",
              structured_output: true,
              release_date: "2025-01-01",
            },
            "tie-b": {
              id: "tie-b",
              name: "Tie B",
              structured_output: true,
              release_date: "2026-03-01",
            },
            "tie-a": {
              id: "tie-a",
              name: "Tie A",
              structured_output: true,
              release_date: "2026-03-01",
            },
            "z-dateless": { id: "z-dateless", name: "Z Dateless", structured_output: true },
            "a-dateless": { id: "a-dateless", name: "A Dateless", structured_output: true },
          },
        },
      },
      fresh(),
    );

    const result = await catalogProviderModels.get("gemini");
    expect(result.models.map((model) => model.id)).toEqual([
      "tie-a",
      "tie-b",
      "older",
      "a-dateless",
      "z-dateless",
    ]);
    // The wire row carries the date it sorted on — and only when one exists.
    expect(result.models[0]?.releaseDate).toBe("2026-03-01");
    expect(result.models[3]).not.toHaveProperty("releaseDate");
  });

  it("serves the sample gemini catalog newest-first", async () => {
    writeCache(MODELS_DEV_SAMPLE, fresh());
    const result = await catalogProviderModels.get("gemini");
    // gemini-3-pro-preview (2025-11-18) is newer than gemini-2.5-flash (2025-03-20).
    expect(result.models.map((model) => model.id)).toEqual([
      "gemini-3-pro-preview",
      "gemini-2.5-flash",
    ]);
  });
});

describe("configuration-bound catalog observations", () => {
  it("labels live responses with models.dev-live observations", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(MODELS_DEV_SAMPLE));
    const live = await discoverConfigurationCatalog({
      configurationId: "cfg-gemini-live",
      productId: "gemini",
    });
    expect(live.status).toBe("passed");
    if (live.status === "passed") {
      expect(live.configurationId).toBe("cfg-gemini-live");
      expect(live.source).toBe("live");
      expect(live.cached).toBe(false);
    }
  });

  it("labels cache responses with models.dev-cache observations", async () => {
    writeCache(MODELS_DEV_SAMPLE, fresh());
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const cached = await discoverConfigurationCatalog({
      configurationId: "cfg-gemini-cache",
      productId: "gemini",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(cached.status).toBe("passed");
    if (cached.status === "passed") {
      expect(cached.configurationId).toBe("cfg-gemini-cache");
      expect(cached.source).toBe("cache");
      expect(cached.cached).toBe(true);
    }
  });

  it("labels snapshot fallbacks with models.dev-snapshot observations", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const snapshot = await discoverConfigurationCatalog({
      configurationId: "cfg-gemini-snapshot",
      productId: "gemini",
    });
    expect(snapshot.status).toBe("passed");
    if (snapshot.status === "passed") {
      expect(snapshot.configurationId).toBe("cfg-gemini-snapshot");
      expect(snapshot.source).toBe("snapshot");
      expect(snapshot.cached).toBe(false);
    }
  });

  it("returns skipped when overlay product discovery yields no catalog models", async () => {
    vi.spyOn(modelsDevCatalog.catalogProviderModels, "get").mockResolvedValue({
      models: [],
      fetchedAt: fresh(),
      source: "snapshot",
      cached: false,
    });

    const result = await discoverConfigurationCatalog({
      configurationId: "cfg-gemini-empty",
      productId: "gemini",
    });

    expect(result).toMatchObject({
      status: "skipped",
      configurationId: "cfg-gemini-empty",
      productId: "gemini",
      models: [],
      reason: CATALOG_EMPTY_MODELS_REASON,
    });
    expect(result.status).not.toBe("passed");
  });

  it("preserves exact upstream model IDs without alias rewriting", async () => {
    const exactId = "provider/exact.model:1";
    writeCache(
      {
        google: {
          id: "google",
          models: {
            [exactId]: {
              id: exactId,
              name: "Exact",
              limit: { context: 131072, output: 8192 },
              structured_output: true,
            },
            "provider/model/latest": {
              id: "provider/model/latest",
              name: "Marketing alias",
            },
          },
        },
      },
      fresh(),
    );

    const result = await catalogProviderModels.get("gemini");
    expect(result.models.map((model) => model.id)).toEqual([exactId]);
    expect(result.models[0]).toMatchObject({ id: exactId, name: "Exact" });
  });

  it("does not project GitHub Models or candidate products from catalog observations", () => {
    const checkedAt = fresh();
    const catalog = {
      google: {
        id: "google",
        models: {
          "gemini-2.5-flash": {
            id: "gemini-2.5-flash",
            name: "Gemini 2.5 Flash",
            structured_output: true,
          },
        },
      },
      "github-models": {
        id: "github-models",
        models: { "gpt-4.1": { id: "gpt-4.1", name: "GitHub Models entry" } },
      },
      "xiaomi-mimo": {
        id: "xiaomi-mimo",
        models: { "mimo-v2": { id: "mimo-v2", name: "Candidate model" } },
      },
    };

    const models = modelInfoFromBoundedObservation(catalog, "gemini", "models.dev-live", checkedAt);
    const serialized = JSON.stringify(models);

    expect(models.map((model) => model.id)).toEqual(["gemini-2.5-flash"]);
    expect(serialized).not.toMatch(POISONED_CATALOG_ENTRY);
    for (const candidateId of CANDIDATE_PRODUCT_IDS) {
      expect(serialized).not.toContain(candidateId);
    }
  });

  it("does not surface GitHub Models or candidate products through discoverConfigurationCatalog", async () => {
    writeCache(
      {
        google: {
          id: "google",
          models: {
            "gemini-2.5-flash": {
              id: "gemini-2.5-flash",
              name: "Gemini 2.5 Flash",
              structured_output: true,
            },
          },
        },
        "github-models": {
          id: "github-models",
          models: { "gpt-4.1": { id: "gpt-4.1", name: "GitHub Models entry" } },
        },
        "xiaomi-mimo": {
          id: "xiaomi-mimo",
          models: { "mimo-v2": { id: "mimo-v2", name: "Candidate model" } },
        },
      },
      fresh(),
    );

    const result = await discoverConfigurationCatalog({
      configurationId: "cfg-gemini-poisoned-catalog",
      productId: "gemini",
    });

    expect(result.status).toBe("passed");
    if (result.status !== "passed") throw new Error("Expected passed catalog discovery");

    const serialized = JSON.stringify(result.models);
    expect(result.configurationId).toBe("cfg-gemini-poisoned-catalog");
    expect(result.models.map((model) => model.id)).toEqual(["gemini-2.5-flash"]);
    expect(serialized).not.toMatch(POISONED_CATALOG_ENTRY);
    for (const candidateId of CANDIDATE_PRODUCT_IDS) {
      expect(serialized).not.toContain(candidateId);
    }
  });
});
