import { AI_PROVIDERS } from "@diffgazer/core/schemas/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadCreate, setupClientTestHome, teardownClientTestHome } from "./client-test-env.js";

// Boundary mock: @ai-sdk/google is the Google Generative AI external HTTP client; tests provide a no-op model factory.
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn(() => ({}))),
}));

// Boundary mock: zhipu-ai-provider is the Zhipu external HTTP client; tests provide a no-op model factory.
vi.mock("zhipu-ai-provider", () => ({
  createZhipu: vi.fn(() => vi.fn(() => ({}))),
}));

// Boundary mock: @openrouter/ai-sdk-provider is the OpenRouter external HTTP client; tests provide a no-op chat factory.
vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: vi.fn(() => ({
    chat: vi.fn(() => ({
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    })),
  })),
}));

// Boundary mock: @ai-sdk/openai-compatible is the OpenAI-compatible external HTTP client (groq, cerebras).
vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn(() => ({
    chatModel: vi.fn(() => ({ doGenerate: vi.fn(), doStream: vi.fn() })),
  })),
}));

describe("createAIClient", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  it("rejects an empty API key as API_KEY_INVALID", async () => {
    const { createAIClient } = await loadCreate();
    const result = createAIClient({
      apiKey: "",
      provider: "gemini",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("API_KEY_INVALID");
    }
  });

  it("rejects an empty provider as UNSUPPORTED_PROVIDER", async () => {
    const { createAIClient } = await loadCreate();
    const result = createAIClient({
      apiKey: "test-key",
      provider: "" as never,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNSUPPORTED_PROVIDER");
    }
  });

  it.each([...AI_PROVIDERS])("creates a client bound to the %s provider", async (provider) => {
    const { createAIClient } = await loadCreate();
    const result = createAIClient({ apiKey: "test-key", provider, model: "some-model" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.provider).toBe(provider);
  });

  it("passes an explicit model id unchanged to the Google nested model factory", async () => {
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
    const { createAIClient } = await loadCreate();
    const result = createAIClient({
      apiKey: "test-key",
      provider: "gemini",
      model: "gemini-explicit-model",
    });
    expect(result.ok).toBe(true);
    expect(createGoogleGenerativeAI).toHaveBeenCalledWith({ apiKey: "test-key" });
    const google = vi.mocked(createGoogleGenerativeAI).mock.results[0]?.value;
    expect(google).toHaveBeenCalledWith("gemini-explicit-model");
  });

  it("passes an explicit model id unchanged to the Zhipu nested model factory", async () => {
    const { createZhipu } = await import("zhipu-ai-provider");
    const { PROVIDER_OVERLAY } = await import("@diffgazer/core/catalog");
    const { createAIClient } = await loadCreate();
    const result = createAIClient({
      apiKey: "test-key",
      provider: "zai",
      model: "zhipu-explicit-model",
    });
    expect(result.ok).toBe(true);
    expect(createZhipu).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "test-key", baseURL: PROVIDER_OVERLAY.zai.baseURL }),
    );
    const zhipu = vi.mocked(createZhipu).mock.results[0]?.value;
    expect(zhipu).toHaveBeenCalledWith("zhipu-explicit-model");
  });

  it("passes an explicit model id unchanged to the OpenRouter nested chat factory", async () => {
    const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
    const { createAIClient } = await loadCreate();
    const result = createAIClient({
      apiKey: "test-key",
      provider: "openrouter",
      model: "openrouter-explicit-model",
    });
    expect(result.ok).toBe(true);
    expect(createOpenRouter).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "test-key", compatibility: "strict" }),
    );
    const chat = vi.mocked(createOpenRouter).mock.results[0]?.value.chat;
    expect(chat).toHaveBeenCalledWith("openrouter-explicit-model");
  });
});
