import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { AI_PROVIDERS } from "@diffgazer/core/schemas/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireValue } from "../../../testing/assertions.js";
import type { StreamMetadata } from "./types.js";

const keyring = vi.hoisted(() => ({
  deleteKeyringSecret: vi.fn(),
  isKeyringAvailable: vi.fn(),
  readKeyringSecret: vi.fn(),
  writeKeyringSecret: vi.fn(),
}));

// Boundary mock: keyring wraps the OS keychain via @napi-rs/keyring; tests provide canned secret read/write results.
vi.mock("../config/keyring.js", () => keyring);

// Boundary mock: `ai` is the Vercel AI SDK external HTTP client; tests provide canned generateObject/streamText responses.
vi.mock("ai", () => ({
  generateObject: vi.fn(),
  streamText: vi.fn(),
}));

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

let diffgazerHome: string;

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function loadClient() {
  return import("./client.js");
}

function setupTempHome() {
  diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-ai-client-"));
  process.env.DIFFGAZER_HOME = diffgazerHome;
  vi.resetModules();
  vi.clearAllMocks();
  keyring.isKeyringAvailable.mockReturnValue(true);
  keyring.readKeyringSecret.mockReturnValue({ ok: true, value: null });
}

function teardownTempHome() {
  delete process.env.DIFFGAZER_HOME;
  rmSync(diffgazerHome, { recursive: true, force: true });
}

describe("createAIClient", () => {
  beforeEach(() => {
    setupTempHome();
    keyring.writeKeyringSecret.mockReturnValue({ ok: true, value: undefined });
    keyring.deleteKeyringSecret.mockReturnValue({ ok: true, value: false });
  });

  afterEach(teardownTempHome);

  it("rejects an empty API key as API_KEY_INVALID", async () => {
    const { createAIClient } = await loadClient();
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
    const { createAIClient } = await loadClient();
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
    const { createAIClient } = await loadClient();
    const result = createAIClient({ apiKey: "test-key", provider, model: "some-model" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.provider).toBe(provider);
  });
});

describe("initializeAIClient", () => {
  beforeEach(() => {
    setupTempHome();
    keyring.writeKeyringSecret.mockReturnValue({ ok: true, value: undefined });
    keyring.deleteKeyringSecret.mockReturnValue({ ok: true, value: false });
  });

  afterEach(teardownTempHome);

  it("reports UNSUPPORTED_PROVIDER when no provider is active", async () => {
    // No config file written — store has no active provider
    const { initializeAIClient } = await loadClient();
    const result = initializeAIClient();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNSUPPORTED_PROVIDER");
    }
  });

  it("reports MODEL_ERROR when the active provider has no model", async () => {
    writeJson(join(diffgazerHome, "config.json"), {
      settings: { secretsStorage: "file" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
    });
    writeJson(join(diffgazerHome, "secrets.json"), { providers: { gemini: "test-key" } });

    const { initializeAIClient } = await loadClient();
    const result = initializeAIClient();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MODEL_ERROR");
    }
  });

  it("reports MODEL_ERROR when the keyring read fails", async () => {
    writeJson(join(diffgazerHome, "config.json"), {
      settings: { secretsStorage: "keyring" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
      ],
    });
    keyring.readKeyringSecret.mockReturnValue({
      ok: false,
      error: { code: "KEYRING_READ_FAILED", message: "keyring error" },
    });

    const { initializeAIClient } = await loadClient();
    const result = initializeAIClient();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MODEL_ERROR");
    }
  });

  it("reports API_KEY_MISSING when no secret has been stored", async () => {
    writeJson(join(diffgazerHome, "config.json"), {
      settings: { secretsStorage: "file" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
      ],
    });
    // No secrets.json → getProviderApiKey returns null

    const { initializeAIClient } = await loadClient();
    const result = initializeAIClient();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("API_KEY_MISSING");
    }
  });

  it("returns a usable client when the active provider has a stored key", async () => {
    writeJson(join(diffgazerHome, "config.json"), {
      settings: { secretsStorage: "file" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
      ],
    });
    writeJson(join(diffgazerHome, "secrets.json"), { providers: { gemini: "test-api-key" } });

    const { initializeAIClient } = await loadClient();
    const result = initializeAIClient();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.provider).toBe("gemini");
    }
  });
});

describe("classifyError (via generate)", () => {
  beforeEach(setupTempHome);
  afterEach(teardownTempHome);

  it.each([
    { providerMessage: "exceeded your current quota", expectedCode: "RATE_LIMITED" },
    { providerMessage: "401 Unauthorized: invalid_api_key", expectedCode: "API_KEY_INVALID" },
    { providerMessage: "429 too many requests", expectedCode: "RATE_LIMITED" },
    { providerMessage: "fetch failed: ECONNREFUSED", expectedCode: "NETWORK_ERROR" },
  ])('maps provider error "$providerMessage" to $expectedCode', async ({
    providerMessage,
    expectedCode,
  }) => {
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockRejectedValue(new Error(providerMessage));

    const { createAIClient } = await loadClient();
    const clientResult = createAIClient({ apiKey: "key", provider: "gemini" });
    expect(clientResult.ok).toBe(true);
    if (!clientResult.ok) return;

    const { z } = await import("zod");
    const result = await clientResult.value.generate("test", z.object({ x: z.string() }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(expectedCode);
    }
  });

  it("surfaces model errors to caller for unclassified provider errors", async () => {
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockRejectedValue(new Error("something unexpected happened"));

    const { createAIClient } = await loadClient();
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

describe("generateStream", () => {
  beforeEach(setupTempHome);
  afterEach(teardownTempHome);

  it("emits each chunk and reports accumulated text on completion", async () => {
    const { streamText } = await import("ai");
    const chunks = ["Hello", " ", "world"];
    vi.mocked(streamText).mockReturnValue({
      textStream: (async function* () {
        for (const chunk of chunks) yield chunk;
      })(),
      finishReason: Promise.resolve("stop"),
    } as unknown as ReturnType<typeof streamText>);

    const { createAIClient } = await loadClient();
    const clientResult = createAIClient({ apiKey: "key", provider: "gemini" });
    expect(clientResult.ok).toBe(true);
    if (!clientResult.ok) return;

    const receivedChunks: string[] = [];
    let completedText = "";
    let completedMeta: StreamMetadata | null = null;

    await clientResult.value.generateStream("test prompt", {
      onChunk: (chunk) => {
        receivedChunks.push(chunk);
      },
      onComplete: (text, meta) => {
        completedText = text;
        completedMeta = meta;
      },
      onError: () => {},
    });

    expect(receivedChunks).toEqual(["Hello", " ", "world"]);
    expect(completedText).toBe("Hello world");
    const meta = requireValue<StreamMetadata>(completedMeta, "completion metadata");
    expect(meta.truncated).toBe(false);
    expect(meta.finishReason).toBe("stop");
  });

  it("reports the thrown error via onError when the stream fails mid-flight", async () => {
    const { streamText } = await import("ai");
    vi.mocked(streamText).mockReturnValue({
      textStream: (async function* () {
        yield "partial";
        throw new Error("stream broke");
      })(),
      finishReason: Promise.resolve("error"),
    } as unknown as ReturnType<typeof streamText>);

    const { createAIClient } = await loadClient();
    const clientResult = createAIClient({ apiKey: "key", provider: "gemini" });
    if (!clientResult.ok) return;

    let capturedError: Error | null = null;

    await clientResult.value.generateStream("test", {
      onChunk: () => {},
      onComplete: () => {},
      onError: (error) => {
        capturedError = error;
      },
    });

    const error = requireValue<Error>(capturedError, "stream error");
    expect(error.message).toBe("stream broke");
  });

  it("flags truncation in completion metadata when finishReason is length", async () => {
    const { streamText } = await import("ai");
    vi.mocked(streamText).mockReturnValue({
      textStream: (async function* () {
        yield "truncated content";
      })(),
      finishReason: Promise.resolve("length"),
    } as unknown as ReturnType<typeof streamText>);

    const { createAIClient } = await loadClient();
    const clientResult = createAIClient({ apiKey: "key", provider: "gemini" });
    if (!clientResult.ok) return;

    let completedMeta: StreamMetadata | null = null;

    await clientResult.value.generateStream("test", {
      onChunk: () => {},
      onComplete: (_text, meta) => {
        completedMeta = meta;
      },
      onError: () => {},
    });

    const meta = requireValue<StreamMetadata>(completedMeta, "completion metadata");
    expect(meta.truncated).toBe(true);
    expect(meta.finishReason).toBe("length");
  });

  it("drops empty chunks from the consumer stream", async () => {
    const { streamText } = await import("ai");
    vi.mocked(streamText).mockReturnValue({
      textStream: (async function* () {
        yield "hello";
        yield "";
        yield "world";
      })(),
      finishReason: Promise.resolve("stop"),
    } as unknown as ReturnType<typeof streamText>);

    const { createAIClient } = await loadClient();
    const clientResult = createAIClient({ apiKey: "key", provider: "gemini" });
    if (!clientResult.ok) return;

    const receivedChunks: string[] = [];
    let completedText = "";

    await clientResult.value.generateStream("test", {
      onChunk: (chunk) => {
        receivedChunks.push(chunk);
      },
      onComplete: (text) => {
        completedText = text;
      },
      onError: () => {},
    });

    expect(receivedChunks).toEqual(["hello", "world"]);
    expect(completedText).toBe("helloworld");
  });
});

describe("createLanguageModel openai-compatible providers", () => {
  beforeEach(setupTempHome);
  afterEach(teardownTempHome);

  it.each([
    { provider: "groq" as const, baseURL: "https://api.groq.com/openai/v1" },
    { provider: "cerebras" as const, baseURL: "https://api.cerebras.ai/v1" },
  ])("creates a $provider client via the openai-compatible factory using the overlay baseURL", async ({
    provider,
    baseURL,
  }) => {
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    const { createAIClient } = await loadClient();
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
    const { createAIClient } = await loadClient();
    const result = createAIClient({ apiKey: "test-key", provider: "cerebras" });
    expect(result.ok).toBe(true);
    const chatModel = vi.mocked(createOpenAICompatible).mock.results[0]?.value.chatModel;
    expect(chatModel).toHaveBeenCalledWith(PROVIDER_OVERLAY.cerebras.defaultModel);
  });
});

describe("createLanguageModel zhipu providers", () => {
  beforeEach(setupTempHome);
  afterEach(teardownTempHome);

  it.each([
    "zai",
    "zai-coding",
  ] as const)("creates a %s client via the zhipu factory using the overlay baseURL", async (provider) => {
    const { createZhipu } = await import("zhipu-ai-provider");
    const { PROVIDER_OVERLAY } = await import("@diffgazer/core/catalog");
    const { createAIClient } = await loadClient();
    const result = createAIClient({ apiKey: "test-key", provider });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.provider).toBe(provider);
    expect(createZhipu).toHaveBeenCalledWith({
      apiKey: "test-key",
      baseURL: PROVIDER_OVERLAY[provider].baseURL,
    });
  });
});

describe("createLanguageModel openrouter without a model", () => {
  beforeEach(setupTempHome);
  afterEach(teardownTempHome);

  it("rejects an empty model id as MODEL_ERROR instead of forwarding it to the SDK", async () => {
    const { createAIClient } = await loadClient();
    const result = createAIClient({ apiKey: "test-key", provider: "openrouter" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MODEL_ERROR");
    }
  });
});
