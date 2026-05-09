import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  loadOpenRouterModelCache,
  persistOpenRouterModelCache,
  fetchOpenRouterModels,
  getOpenRouterModelsWithCache,
} from "./openrouter-models.js";

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

describe("loadOpenRouterModelCache", () => {
  it("returns null when no cache file exists", () => {
    expect(loadOpenRouterModelCache()).toBeNull();
  });

  it("returns parsed cache when valid", () => {
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
    writeCacheFile(cache);

    const result = loadOpenRouterModelCache();
    expect(result).not.toBeNull();
    expect(result!.models).toHaveLength(1);
  });
});

describe("persistOpenRouterModelCache", () => {
  it("writes cache to the global OpenRouter models file", () => {
    const cache = {
      models: [],
      fetchedAt: new Date().toISOString(),
    };

    persistOpenRouterModelCache(cache);

    expect(JSON.parse(fs.readFileSync(cachePath(), "utf-8"))).toEqual(cache);
  });
});

describe("fetchOpenRouterModels", () => {
  it("parses models from API response", async () => {
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

    const result = await fetchOpenRouterModels("test-key");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]!.id).toBe("openai/gpt-4");
    }
    expect(fetch).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/models",
      expect.objectContaining({
        headers: { Authorization: "Bearer test-key" },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("returns error on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    const result = await fetchOpenRouterModels("bad-key");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("401");
    }
  });

  it("filters out invalid models without an id", async () => {
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

    const result = await fetchOpenRouterModels("key");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]!.id).toBe("valid/model");
    }
  });

  it("handles array response without a data wrapper", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "model/1", name: "M1", context_length: 4096, pricing: { prompt: "0", completion: "0" } },
      ],
    } as Response);

    const result = await fetchOpenRouterModels("key");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
    }
  });
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

  it("returns error when fetch fails and no cache exists", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));

    const result = await getOpenRouterModelsWithCache("key");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("network error");
    }
  });
});
