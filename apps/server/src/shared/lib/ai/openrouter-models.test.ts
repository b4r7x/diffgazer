import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../paths.js", () => ({
  getGlobalOpenRouterModelsPath: () => "/mock/.stargazer/openrouter-models.json",
}));

vi.mock("../fs.js", () => ({
  readJsonFileSync: vi.fn(),
  writeJsonFileSync: vi.fn(),
}));

import { readJsonFileSync, writeJsonFileSync } from "../fs.js";
import {
  loadOpenRouterModelCache,
  persistOpenRouterModelCache,
  fetchOpenRouterModels,
  getOpenRouterModelsWithCache,
} from "./openrouter-models.js";

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("loadOpenRouterModelCache", () => {
  it("should return null when no cache file", () => {
    vi.mocked(readJsonFileSync).mockReturnValue(null);
    expect(loadOpenRouterModelCache()).toBeNull();
  });

  it("should return parsed cache when valid", () => {
    const cache = {
      models: [
        {
          id: "model-1",
          name: "Model 1",
          contextLength: 4096,
          pricing: { prompt: "0.001", completion: "0.002" },
          isFree: false,
        },
      ],
      fetchedAt: new Date().toISOString(),
    };
    vi.mocked(readJsonFileSync).mockReturnValue(cache);

    const result = loadOpenRouterModelCache();
    expect(result).not.toBeNull();
    expect(result!.models).toHaveLength(1);
  });
});

describe("persistOpenRouterModelCache", () => {
  it("should write cache to file", () => {
    const cache = {
      models: [],
      fetchedAt: new Date().toISOString(),
    };
    persistOpenRouterModelCache(cache);

    expect(writeJsonFileSync).toHaveBeenCalledWith(
      "/mock/.stargazer/openrouter-models.json",
      cache,
    );
  });
});

describe("fetchOpenRouterModels", () => {
  it("should parse models from API response", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        data: [
          {
            id: "openai/gpt-4",
            name: "GPT-4",
            context_length: 8192,
            pricing: { prompt: "0.03", completion: "0.06" },
          },
        ],
      }),
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as Response);

    const models = await fetchOpenRouterModels("test-key");

    expect(models).toHaveLength(1);
    expect(models[0]!.id).toBe("openai/gpt-4");
    expect(fetch).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/models",
      { headers: { Authorization: "Bearer test-key" } },
    );
  });

  it("should throw on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    await expect(fetchOpenRouterModels("bad-key")).rejects.toThrow("401");
  });

  it("should filter out invalid models (no id)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: "valid/model", name: "Valid", context_length: 4096, pricing: { prompt: "0", completion: "0" } },
          { name: "No ID", context_length: 4096 },
          null,
        ],
      }),
    } as Response);

    const models = await fetchOpenRouterModels("key");
    expect(models).toHaveLength(1);
    expect(models[0]!.id).toBe("valid/model");
  });

  it("should handle array response (no data wrapper)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "model/1", name: "M1", context_length: 4096, pricing: { prompt: "0", completion: "0" } },
      ],
    } as Response);

    const models = await fetchOpenRouterModels("key");
    expect(models).toHaveLength(1);
  });
});

describe("getOpenRouterModelsWithCache", () => {
  it("should return cached data within TTL", async () => {
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
    };
    vi.mocked(readJsonFileSync).mockReturnValue(cache);

    const result = await getOpenRouterModelsWithCache("key");

    expect(result.cached).toBe(true);
    expect(result.models).toHaveLength(1);
  });

  it("should refetch after TTL expires", async () => {
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    vi.mocked(readJsonFileSync).mockReturnValue({
      models: [{ id: "old", name: "Old", contextLength: 0, pricing: { prompt: "0", completion: "0" }, isFree: true, supportedParameters: ["temperature"] }],
      fetchedAt: oldDate,
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: "new/model", name: "New", context_length: 4096, pricing: { prompt: "0", completion: "0" } },
        ],
      }),
    } as Response);

    const result = await getOpenRouterModelsWithCache("key");

    expect(result.cached).toBe(false);
    expect(fetch).toHaveBeenCalled();
  });

  it("should fall back to cache on fetch failure", async () => {
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
    };
    vi.mocked(readJsonFileSync).mockReturnValue(cache);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));

    const result = await getOpenRouterModelsWithCache("key");

    expect(result.cached).toBe(true);
    expect(result.models).toHaveLength(1);
  });

  it("should throw when fetch fails and no cache exists", async () => {
    vi.mocked(readJsonFileSync).mockReturnValue(null);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));

    await expect(getOpenRouterModelsWithCache("key")).rejects.toThrow();
  });
});
