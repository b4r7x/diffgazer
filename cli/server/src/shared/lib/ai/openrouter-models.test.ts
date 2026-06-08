import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hashApiKey = (apiKey: string): string =>
  createHash("sha256").update(apiKey).digest("hex").slice(0, 16);

import { fetchOpenRouterModels, getOpenRouterModelsWithCache } from "./openrouter-models.js";

let testHome: string;
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

const cachePath = (): string => path.join(testHome, "openrouter-models.json");

const writeCacheFile = (cache: unknown): void => {
  fs.writeFileSync(cachePath(), `${JSON.stringify(cache, null, 2)}\n`);
};

const chunkedResponse = (text: string, headers?: Record<string, string>): Response => {
  const bytes = new TextEncoder().encode(text);
  return {
    ok: true,
    status: 200,
    headers: new Headers(headers),
    body: new ReadableStream({
      start(controller) {
        let offset = 0;
        const chunkSize = 64 * 1024;
        while (offset < bytes.length) {
          controller.enqueue(bytes.slice(offset, offset + chunkSize));
          offset += chunkSize;
        }
        controller.close();
      },
    }),
  } as Response;
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
      expect(result.value[0]?.id).toBe("openai/gpt-4");
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

  it("returns an error when the network call throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const result = await fetchOpenRouterModels("key");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("network down");
  });

  it("filters out invalid models without an id", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "valid/model",
            name: "Valid",
            context_length: 4096,
            pricing: { prompt: "0", completion: "0" },
          },
          { name: "No ID", context_length: 4096 },
          null,
        ],
      }),
    } as Response);

    const result = await fetchOpenRouterModels("key");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.id).toBe("valid/model");
    }
  });

  it("handles array response without a data wrapper", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "model/1",
          name: "M1",
          context_length: 4096,
          pricing: { prompt: "0", completion: "0" },
        },
      ],
    } as Response);

    const result = await fetchOpenRouterModels("key");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
    }
  });

  it("returns an error when the response shape is not an array", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "not-an-array" } }),
    } as Response);

    const result = await fetchOpenRouterModels("key");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("not an array");
  });

  it("rejects a chunked response that exceeds the size limit without Content-Length", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      chunkedResponse(`{"data":[{"id":"model","name":"${"x".repeat(MAX_RESPONSE_BYTES)}"}]}`),
    );

    const result = await fetchOpenRouterModels("key");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message.toLowerCase()).toContain("too large");
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
});
