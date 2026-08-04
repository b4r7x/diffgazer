import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeChunkedResponse } from "../testing/http.js";
import { fetchOpenRouterModels } from "./openrouter-models.js";

const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

beforeEach(() => {
  vi.restoreAllMocks();
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
            top_provider: { max_completion_tokens: 2048 },
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
      expect(result.value[0]?.maxCompletionTokens).toBe(2048);
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
          {
            id: "valid/second-model",
            name: "Second valid",
            context_length: 4096,
            pricing: { prompt: "0", completion: "0" },
          },
          { name: "No ID", context_length: 4096 },
        ],
      }),
    } as Response);

    const result = await fetchOpenRouterModels("key");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((model) => model.id)).toEqual(["valid/model", "valid/second-model"]);
    }
  });

  it("rejects a response that parses to zero models", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);

    const result = await fetchOpenRouterModels("key");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("zero models");
  });

  it("rejects a response with a mass parsing drop", async () => {
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

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("corruption guard");
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
      makeChunkedResponse(`{"data":[{"id":"model","name":"${"x".repeat(MAX_RESPONSE_BYTES)}"}]}`),
    );

    const result = await fetchOpenRouterModels("key");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message.toLowerCase()).toContain("too large");
  });
});
