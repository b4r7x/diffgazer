import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_RESPONSE_BYTES } from "../http-json.js";
import { loadCreate, setupClientTestHome, teardownClientTestHome } from "./client-test-env.js";

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

describe("createLanguageModel openai-compatible providers", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  it.each([
    { provider: "groq" as const, baseURL: "https://api.groq.com/openai/v1" },
    { provider: "cerebras" as const, baseURL: "https://api.cerebras.ai/v1" },
  ])("creates a $provider client via the openai-compatible factory using the overlay baseURL", async ({
    provider,
    baseURL,
  }) => {
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    const { createAIClient } = await loadCreate();
    const result = createAIClient({ apiKey: "test-key", provider });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.provider).toBe(provider);
    expect(createOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "test-key", baseURL, name: provider }),
    );
  });

  it("uses the overlay defaultModel when no model is supplied for an openai-compatible provider", async () => {
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    const { PROVIDER_OVERLAY } = await import("@diffgazer/core/catalog");
    const { createAIClient } = await loadCreate();
    const result = createAIClient({ apiKey: "test-key", provider: "cerebras" });
    expect(result.ok).toBe(true);
    const chatModel = vi.mocked(createOpenAICompatible).mock.results[0]?.value.chatModel;
    expect(chatModel).toHaveBeenCalledWith(PROVIDER_OVERLAY.cerebras.defaultModel);
  });
});

describe("createLanguageModel zhipu providers", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  it.each([
    "zai",
    "zai-coding",
  ] as const)("creates a %s client via the zhipu factory using the overlay baseURL", async (provider) => {
    const { createZhipu } = await import("zhipu-ai-provider");
    const { PROVIDER_OVERLAY } = await import("@diffgazer/core/catalog");
    const { createAIClient } = await loadCreate();
    const result = createAIClient({ apiKey: "test-key", provider });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.provider).toBe(provider);
    expect(createZhipu).toHaveBeenCalledWith({
      apiKey: "test-key",
      baseURL: PROVIDER_OVERLAY[provider].baseURL,
      fetch: expect.any(Function),
    });
  });

  it("rejects an oversized declared response before the Zhipu SDK can read it", async () => {
    const response = new Response("{}", {
      headers: { "content-length": String(MAX_RESPONSE_BYTES + 1) },
    });
    if (!response.body) throw new Error("response body missing");
    const getReader = vi.spyOn(response.body, "getReader");
    const upstreamFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
    const { createZhipu } = await import("zhipu-ai-provider");
    const { createAIClient } = await loadCreate();

    createAIClient({ apiKey: "test-key", provider: "zai" });
    const limitingFetch = vi.mocked(createZhipu).mock.calls[0]?.[0]?.fetch;
    if (!limitingFetch) throw new Error("Zhipu limiting fetch missing");

    await expect(limitingFetch("https://api.z.ai/test")).rejects.toThrow("response too large");
    expect(upstreamFetch).toHaveBeenCalledOnce();
    expect(getReader).not.toHaveBeenCalled();
  });

  it("allows a headerless Zhipu response at the exact byte ceiling", async () => {
    const response = new Response(new Uint8Array(MAX_RESPONSE_BYTES));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
    const { createZhipu } = await import("zhipu-ai-provider");
    const { createAIClient } = await loadCreate();

    createAIClient({ apiKey: "test-key", provider: "zai" });
    const limitingFetch = vi.mocked(createZhipu).mock.calls[0]?.[0]?.fetch;
    if (!limitingFetch) throw new Error("Zhipu limiting fetch missing");

    const limited = await limitingFetch("https://api.z.ai/test");
    await expect(limited.arrayBuffer()).resolves.toHaveProperty("byteLength", MAX_RESPONSE_BYTES);
  });

  it("cancels a headerless Zhipu stream on the first byte above the ceiling", async () => {
    const cancel = vi.fn();
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(MAX_RESPONSE_BYTES));
          controller.enqueue(new Uint8Array(1));
        },
        cancel,
      }),
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
    const { createZhipu } = await import("zhipu-ai-provider");
    const { createAIClient } = await loadCreate();

    createAIClient({ apiKey: "test-key", provider: "zai" });
    const limitingFetch = vi.mocked(createZhipu).mock.calls[0]?.[0]?.fetch;
    if (!limitingFetch) throw new Error("Zhipu limiting fetch missing");

    const limited = await limitingFetch("https://api.z.ai/test");
    await expect(limited.arrayBuffer()).rejects.toThrow(`${MAX_RESPONSE_BYTES + 1} bytes`);
    expect(cancel).toHaveBeenCalledOnce();
  });
});

describe("createLanguageModel openrouter without a model", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  it("rejects an empty model id as MODEL_ERROR instead of forwarding it to the SDK", async () => {
    const { createAIClient } = await loadCreate();
    const result = createAIClient({ apiKey: "test-key", provider: "openrouter" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MODEL_ERROR");
    }
  });
});
