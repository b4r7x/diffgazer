import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getOpenRouterModels } from "./openrouter-models.js";
import type { OpenRouterModelCache } from "@repo/schemas/config";

vi.mock("node:fs/promises");
vi.mock("./paths.js", () => ({
  paths: { config: "/tmp/test-stargazer" },
}));

const mockFs = await import("node:fs/promises");
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

const MOCK_API_RESPONSE = {
  data: [
    {
      id: "openai/gpt-4o",
      name: "GPT-4o",
      description: "OpenAI's GPT-4o",
      context_length: 128000,
      pricing: { prompt: "0.000005", completion: "0.000015" },
    },
    {
      id: "meta-llama/llama-3.1-8b-instruct:free",
      name: "Llama 3.1 8B Instruct (free)",
      description: "Free Llama model",
      context_length: 128000,
      pricing: { prompt: "0", completion: "0" },
    },
  ],
};

const MOCK_CACHE: OpenRouterModelCache = {
  models: [
    {
      id: "cached/model",
      name: "Cached Model",
      description: "From cache",
      contextLength: 8000,
      pricing: { prompt: "0.000001", completion: "0.000002" },
      isFree: false,
    },
  ],
  fetchedAt: new Date(Date.now() - 1000).toISOString(), // 1 second ago
};

describe("getOpenRouterModels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns cached models when cache is valid", async () => {
    vi.mocked(mockFs.readFile).mockResolvedValue(JSON.stringify(MOCK_CACHE));

    const result = await getOpenRouterModels();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.id).toBe("cached/model");
    }
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockFs.readFile).toHaveBeenCalledWith(
      "/tmp/test-stargazer/openrouter-models.json",
      "utf-8"
    );
  });

  it("fetches fresh models when cache is expired", async () => {
    const expiredCache = {
      ...MOCK_CACHE,
      fetchedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
    };
    vi.mocked(mockFs.readFile).mockResolvedValue(JSON.stringify(expiredCache));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => MOCK_API_RESPONSE,
    });

    const result = await getOpenRouterModels();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0]?.id).toBe("openai/gpt-4o");
      expect(result.value[0]?.isFree).toBe(false);
      expect(result.value[1]?.id).toBe("meta-llama/llama-3.1-8b-instruct:free");
      expect(result.value[1]?.isFree).toBe(true);
    }
    expect(mockFetch).toHaveBeenCalledWith("https://openrouter.ai/api/v1/models");
    expect(mockFs.writeFile).toHaveBeenCalled();
  });

  it("fetches fresh models when cache file does not exist", async () => {
    vi.mocked(mockFs.readFile).mockRejectedValue(new Error("ENOENT"));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => MOCK_API_RESPONSE,
    });

    const result = await getOpenRouterModels();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
    }
    expect(mockFetch).toHaveBeenCalled();
  });

  it("fetches fresh models when cache is invalid JSON", async () => {
    vi.mocked(mockFs.readFile).mockResolvedValue("invalid json");
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => MOCK_API_RESPONSE,
    });

    const result = await getOpenRouterModels();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
    }
    expect(mockFetch).toHaveBeenCalled();
  });

  it("fetches fresh models when cache schema is invalid", async () => {
    const invalidCache = { models: "not-an-array", fetchedAt: "2024-01-01" };
    vi.mocked(mockFs.readFile).mockResolvedValue(JSON.stringify(invalidCache));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => MOCK_API_RESPONSE,
    });

    const result = await getOpenRouterModels();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
    }
    expect(mockFetch).toHaveBeenCalled();
  });

  it("fetches fresh models when forceRefresh is true", async () => {
    vi.mocked(mockFs.readFile).mockResolvedValue(JSON.stringify(MOCK_CACHE));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => MOCK_API_RESPONSE,
    });

    const result = await getOpenRouterModels(true);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0]?.id).toBe("openai/gpt-4o");
    }
    expect(mockFetch).toHaveBeenCalled();
    expect(mockFs.readFile).not.toHaveBeenCalled();
  });

  it("returns error on API failure with non-ok status", async () => {
    vi.mocked(mockFs.readFile).mockRejectedValue(new Error("ENOENT"));
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await getOpenRouterModels();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("OpenRouter API error: 500");
    }
  });

  it("returns error on API failure with 404", async () => {
    vi.mocked(mockFs.readFile).mockRejectedValue(new Error("ENOENT"));
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await getOpenRouterModels();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("404");
    }
  });

  it("returns error on network failure", async () => {
    vi.mocked(mockFs.readFile).mockRejectedValue(new Error("ENOENT"));
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await getOpenRouterModels();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Network error");
    }
  });

  it("returns error on fetch timeout", async () => {
    vi.mocked(mockFs.readFile).mockRejectedValue(new Error("ENOENT"));
    mockFetch.mockRejectedValue(new Error("Request timeout"));

    const result = await getOpenRouterModels();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Request timeout");
    }
  });

  it("saves cache with correct structure and permissions", async () => {
    vi.mocked(mockFs.readFile).mockRejectedValue(new Error("ENOENT"));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => MOCK_API_RESPONSE,
    });

    await getOpenRouterModels();

    expect(mockFs.mkdir).toHaveBeenCalledWith("/tmp/test-stargazer", { recursive: true });
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      "/tmp/test-stargazer/openrouter-models.json",
      expect.stringContaining('"models"'),
      { mode: 0o600 }
    );

    const writeCall = vi.mocked(mockFs.writeFile).mock.calls[0];
    if (writeCall) {
      const cacheContent = JSON.parse(writeCall[1] as string);
      expect(cacheContent).toHaveProperty("models");
      expect(cacheContent).toHaveProperty("fetchedAt");
      expect(Array.isArray(cacheContent.models)).toBe(true);
    }
  });

  it("transforms API response correctly", async () => {
    vi.mocked(mockFs.readFile).mockRejectedValue(new Error("ENOENT"));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => MOCK_API_RESPONSE,
    });

    const result = await getOpenRouterModels();

    expect(result.ok).toBe(true);
    if (result.ok) {
      const model = result.value[0];
      expect(model).toMatchObject({
        id: "openai/gpt-4o",
        name: "GPT-4o",
        description: "OpenAI's GPT-4o",
        contextLength: 128000,
        pricing: { prompt: "0.000005", completion: "0.000015" },
        isFree: false,
      });
    }
  });

  it("correctly identifies free models", async () => {
    vi.mocked(mockFs.readFile).mockRejectedValue(new Error("ENOENT"));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => MOCK_API_RESPONSE,
    });

    const result = await getOpenRouterModels();

    expect(result.ok).toBe(true);
    if (result.ok) {
      const freeModel = result.value.find((m) => m.id === "meta-llama/llama-3.1-8b-instruct:free");
      const paidModel = result.value.find((m) => m.id === "openai/gpt-4o");
      expect(freeModel?.isFree).toBe(true);
      expect(paidModel?.isFree).toBe(false);
    }
  });
});
