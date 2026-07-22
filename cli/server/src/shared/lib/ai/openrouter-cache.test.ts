import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOpenRouterModelsWithCache } from "./openrouter-models.js";

const hashApiKey = (apiKey: string): string =>
  createHash("sha256").update(apiKey).digest("hex").slice(0, 16);

let testHome: string;

const cachePath = (): string => path.join(testHome, "openrouter-models.json");

const writeCacheFile = (cache: unknown): void => {
  fs.writeFileSync(cachePath(), `${JSON.stringify(cache, null, 2)}\n`);
};

beforeEach(() => {
  testHome = fs.mkdtempSync(path.join(os.tmpdir(), "dg-openrouter-models-"));
  process.env.DIFFGAZER_HOME = testHome;
  vi.restoreAllMocks();
});

afterEach(() => {
  delete process.env.DIFFGAZER_HOME;
  fs.rmSync(testHome, { recursive: true, force: true });
});

describe("getOpenRouterModelsWithCache", () => {
  it("returns cached data within TTL", async () => {
    const cache = {
      models: [
        {
          id: "cached/model",
          name: "Cached",
          contextLength: 4096,
          pricing: { prompt: "0", completion: "0" },
          isFree: true,
          supportedParameters: ["temperature"],
        },
      ],
      fetchedAt: new Date().toISOString(),
      keyHash: hashApiKey("key"),
    };
    writeCacheFile(cache);

    const result = await getOpenRouterModelsWithCache("key");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cached).toBe(true);
      expect(result.value.models).toHaveLength(1);
    }
  });

  it("refetches after TTL expires", async () => {
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    writeCacheFile({
      models: [
        {
          id: "old",
          name: "Old",
          contextLength: 0,
          pricing: { prompt: "0", completion: "0" },
          isFree: true,
          supportedParameters: ["temperature"],
        },
      ],
      fetchedAt: oldDate,
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "new/model",
            name: "New",
            context_length: 4096,
            pricing: { prompt: "0", completion: "0" },
          },
        ],
      }),
    } as Response);

    const result = await getOpenRouterModelsWithCache("key");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cached).toBe(false);
      expect(result.value.models.map((model) => model.id)).toEqual(["new/model"]);
    }
  });

  it("falls back to cache on fetch failure", async () => {
    const cache = {
      models: [
        {
          id: "cached/model",
          name: "Cached",
          contextLength: 4096,
          pricing: { prompt: "0", completion: "0" },
          isFree: true,
          supportedParameters: ["temperature"],
        },
      ],
      fetchedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      keyHash: hashApiKey("key"),
    };
    writeCacheFile(cache);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));

    const result = await getOpenRouterModelsWithCache("key");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cached).toBe(true);
      expect(result.value.models).toHaveLength(1);
    }
  });

  it("reuses a fresh cache even when supported parameter metadata is unknown", async () => {
    writeCacheFile({
      models: [
        {
          id: "cached/unknown-compat",
          name: "Cached",
          contextLength: 4096,
          pricing: { prompt: "0", completion: "0" },
          isFree: true,
        },
      ],
      fetchedAt: new Date().toISOString(),
      keyHash: hashApiKey("key"),
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await getOpenRouterModelsWithCache("key");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cached).toBe(true);
      expect(result.value.models.map((model) => model.id)).toEqual(["cached/unknown-compat"]);
    }
  });

  it("returns error when fetch fails and no cache exists", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));

    const result = await getOpenRouterModelsWithCache("key");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("network error");
    }
  });

  it("keeps the matching stale cache when zero models are returned", async () => {
    const cached = {
      models: [
        {
          id: "cached/model",
          name: "Cached",
          contextLength: 4096,
          pricing: { prompt: "0", completion: "0" },
          isFree: true,
          supportedParameters: ["temperature"],
        },
      ],
      fetchedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      keyHash: hashApiKey("key"),
    };
    writeCacheFile(cached);
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);

    const result = await getOpenRouterModelsWithCache("key");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cached).toBe(true);
      expect(result.value.models.map((model) => model.id)).toEqual(["cached/model"]);
    }
    expect(JSON.parse(fs.readFileSync(cachePath(), "utf8"))).toEqual(cached);
  });

  it("keeps the matching stale cache when a mass parsing drop occurs", async () => {
    const cached = {
      models: [
        {
          id: "cached/model",
          name: "Cached",
          contextLength: 4096,
          pricing: { prompt: "0", completion: "0" },
          isFree: true,
          supportedParameters: ["temperature"],
        },
      ],
      fetchedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      keyHash: hashApiKey("key"),
    };
    writeCacheFile(cached);
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "live/model",
            name: "Live",
            context_length: 4096,
            pricing: { prompt: "0", completion: "0" },
          },
          { name: "Dropped 1" },
          { name: "Dropped 2" },
        ],
      }),
    } as Response);

    const result = await getOpenRouterModelsWithCache("key");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cached).toBe(true);
      expect(result.value.models.map((model) => model.id)).toEqual(["cached/model"]);
    }
    expect(JSON.parse(fs.readFileSync(cachePath(), "utf8"))).toEqual(cached);
  });

  it("coalesces concurrent authenticated fetches and retries after a failed generation", async () => {
    const apiKey = "sk-test-key";
    const failedGeneration = createDeferred<Response>();
    const retryGeneration = createDeferred<Response>();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockReturnValueOnce(failedGeneration.promise)
      .mockReturnValueOnce(retryGeneration.promise);

    const failedRequests = Array.from({ length: 8 }, () => getOpenRouterModelsWithCache(apiKey));
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    failedGeneration.reject(new Error("network down"));

    const failedResults = await Promise.all(failedRequests);
    expect(failedResults.every((result) => !result.ok)).toBe(true);
    const firstFailure = failedResults[0];
    expect(firstFailure?.ok).toBe(false);
    if (firstFailure?.ok !== false) throw new Error("expected concurrent fetch failures");
    const failedMessage = firstFailure.error.message;
    expect(
      failedResults.every(
        (result) => !result.ok && result.error.message === failedMessage,
      ),
    ).toBe(true);

    const retryRequests = Array.from({ length: 8 }, () => getOpenRouterModelsWithCache(apiKey));
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    retryGeneration.resolve({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        data: [
          {
            id: "openai/test-model",
            name: "Test Model",
            context_length: 4096,
            supported_parameters: ["response_format"],
            pricing: { prompt: "0", completion: "0" },
          },
        ],
      }),
    } as Response);

    const retryResults = await Promise.all(retryRequests);
    expect(retryResults.every((result) => result.ok)).toBe(true);
    expect(new Set(retryResults.map((result) => JSON.stringify(result))).size).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
