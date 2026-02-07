import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", () => ({
  generateObject: vi.fn(),
  streamText: vi.fn(),
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn(() => ({}))),
}));

vi.mock("zhipu-ai-provider", () => ({
  createZhipu: vi.fn(() => vi.fn(() => ({}))),
}));

vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: vi.fn(() => ({ chat: vi.fn(() => ({})) })),
}));

vi.mock("../config/store.js", () => ({
  getActiveProvider: vi.fn(),
  getProviderApiKey: vi.fn(),
}));

import { createAIClient, initializeAIClient } from "./client.js";
import { getActiveProvider, getProviderApiKey } from "../config/store.js";

const mockGetActiveProvider = vi.mocked(getActiveProvider);
const mockGetProviderApiKey = vi.mocked(getProviderApiKey);

describe("createAIClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return error when API key is missing", () => {
    const result = createAIClient({
      apiKey: "",
      provider: "gemini",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("API_KEY_INVALID");
    }
  });

  it("should return error when provider is empty", () => {
    const result = createAIClient({
      apiKey: "test-key",
      provider: "" as any,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNSUPPORTED_PROVIDER");
    }
  });

  it("should create client for gemini provider", () => {
    const result = createAIClient({
      apiKey: "test-key",
      provider: "gemini",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.provider).toBe("gemini");
    }
  });

  it("should create client for zai provider", () => {
    const result = createAIClient({
      apiKey: "test-key",
      provider: "zai",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.provider).toBe("zai");
    }
  });

  it("should create client for zai-coding provider", () => {
    const result = createAIClient({
      apiKey: "test-key",
      provider: "zai-coding",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.provider).toBe("zai-coding");
    }
  });

  it("should create client for openrouter provider", () => {
    const result = createAIClient({
      apiKey: "test-key",
      provider: "openrouter",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.provider).toBe("openrouter");
    }
  });
});

describe("initializeAIClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return error when no active provider is configured", () => {
    mockGetActiveProvider.mockReturnValue(null);

    const result = initializeAIClient();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNSUPPORTED_PROVIDER");
    }
  });

  it("should return error when active provider has no model", () => {
    mockGetActiveProvider.mockReturnValue({
      provider: "gemini",
      hasApiKey: true,
      isActive: true,
    });

    const result = initializeAIClient();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MODEL_ERROR");
    }
  });

  it("should return error when API key retrieval fails", () => {
    mockGetActiveProvider.mockReturnValue({
      provider: "gemini",
      hasApiKey: true,
      isActive: true,
      model: "gemini-2.5-flash",
    });
    mockGetProviderApiKey.mockReturnValue({
      ok: false,
      error: { code: "KEYRING_READ_FAILED" as any, message: "keyring error" },
    });

    const result = initializeAIClient();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MODEL_ERROR");
    }
  });

  it("should return error when API key is null", () => {
    mockGetActiveProvider.mockReturnValue({
      provider: "gemini",
      hasApiKey: true,
      isActive: true,
      model: "gemini-2.5-flash",
    });
    mockGetProviderApiKey.mockReturnValue({ ok: true, value: null });

    const result = initializeAIClient();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("API_KEY_MISSING");
    }
  });

  it("should return a client when provider and API key are valid", () => {
    mockGetActiveProvider.mockReturnValue({
      provider: "gemini",
      hasApiKey: true,
      isActive: true,
      model: "gemini-2.5-flash",
    });
    mockGetProviderApiKey.mockReturnValue({ ok: true, value: "test-api-key" });

    const result = initializeAIClient();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.provider).toBe("gemini");
    }
  });
});

describe("classifyError (via generate)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should classify quota errors as RATE_LIMITED", async () => {
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockRejectedValue(new Error("exceeded your current quota"));

    const clientResult = createAIClient({ apiKey: "key", provider: "gemini" });
    expect(clientResult.ok).toBe(true);
    if (!clientResult.ok) return;

    const { z } = await import("zod");
    const result = await clientResult.value.generate("test", z.object({ x: z.string() }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("RATE_LIMITED");
    }
  });

  it("should classify 401 errors as API_KEY_INVALID", async () => {
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockRejectedValue(new Error("401 Unauthorized: invalid_api_key"));

    const clientResult = createAIClient({ apiKey: "key", provider: "gemini" });
    if (!clientResult.ok) return;

    const { z } = await import("zod");
    const result = await clientResult.value.generate("test", z.object({ x: z.string() }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("API_KEY_INVALID");
    }
  });

  it("should classify rate limit (429) errors as RATE_LIMITED", async () => {
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockRejectedValue(new Error("429 too many requests"));

    const clientResult = createAIClient({ apiKey: "key", provider: "gemini" });
    if (!clientResult.ok) return;

    const { z } = await import("zod");
    const result = await clientResult.value.generate("test", z.object({ x: z.string() }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("RATE_LIMITED");
    }
  });

  it("should classify network errors as NETWORK_ERROR", async () => {
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockRejectedValue(new Error("fetch failed: ECONNREFUSED"));

    const clientResult = createAIClient({ apiKey: "key", provider: "gemini" });
    if (!clientResult.ok) return;

    const { z } = await import("zod");
    const result = await clientResult.value.generate("test", z.object({ x: z.string() }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NETWORK_ERROR");
    }
  });

  it("should classify unknown errors as MODEL_ERROR", async () => {
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockRejectedValue(new Error("something unexpected happened"));

    const clientResult = createAIClient({ apiKey: "key", provider: "gemini" });
    if (!clientResult.ok) return;

    const { z } = await import("zod");
    const result = await clientResult.value.generate("test", z.object({ x: z.string() }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MODEL_ERROR");
    }
  });
});
