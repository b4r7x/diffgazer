import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { AI_PROVIDERS } from "@diffgazer/core/schemas/config";

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

  it("should return error when API key is missing", async () => {
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

  it("should return error when provider is empty", async () => {
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

  it.each([...AI_PROVIDERS])(
    "should create client for %s provider",
    async (provider) => {
      const { createAIClient } = await loadClient();
      const result = createAIClient({ apiKey: "test-key", provider });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.provider).toBe(provider);
    },
  );
});

describe("initializeAIClient", () => {
  beforeEach(() => {
    setupTempHome();
    keyring.writeKeyringSecret.mockReturnValue({ ok: true, value: undefined });
    keyring.deleteKeyringSecret.mockReturnValue({ ok: true, value: false });
  });

  afterEach(teardownTempHome);

  it("should return error when no active provider is configured", async () => {
    // No config file written — store has no active provider
    const { initializeAIClient } = await loadClient();
    const result = initializeAIClient();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNSUPPORTED_PROVIDER");
    }
  });

  it("should return error when active provider has no model", async () => {
    // Provider is active but has no model set
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

  it("should return error when API key retrieval fails", async () => {
    // Provider has model but keyring read fails
    writeJson(join(diffgazerHome, "config.json"), {
      settings: { secretsStorage: "keyring" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" }],
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

  it("should return error when API key is null", async () => {
    // Provider is configured with model, but no secret stored (no secrets.json, no keyring value)
    writeJson(join(diffgazerHome, "config.json"), {
      settings: { secretsStorage: "file" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" }],
    });
    // No secrets.json → getProviderApiKey returns null

    const { initializeAIClient } = await loadClient();
    const result = initializeAIClient();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("API_KEY_MISSING");
    }
  });

  it("should return a client when provider and API key are valid", async () => {
    writeJson(join(diffgazerHome, "config.json"), {
      settings: { secretsStorage: "file" },
      providers: [{ provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" }],
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

  it("should classify quota errors as RATE_LIMITED", async () => {
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockRejectedValue(new Error("exceeded your current quota"));

    const { createAIClient } = await loadClient();
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

    const { createAIClient } = await loadClient();
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

    const { createAIClient } = await loadClient();
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

    const { createAIClient } = await loadClient();
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

  it("should stream chunks and call onComplete with accumulated text", async () => {
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
    let completedMeta: any = null;

    await clientResult.value.generateStream("test prompt", {
      onChunk: (chunk) => { receivedChunks.push(chunk); },
      onComplete: (text, meta) => { completedText = text; completedMeta = meta; },
      onError: () => {},
    });

    expect(receivedChunks).toEqual(["Hello", " ", "world"]);
    expect(completedText).toBe("Hello world");
    expect(completedMeta.truncated).toBe(false);
    expect(completedMeta.finishReason).toBe("stop");
  });

  it("should call onError when streaming throws", async () => {
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
      onError: (error) => { capturedError = error; },
    });

    expect(capturedError).not.toBeNull();
    expect(capturedError!.message).toBe("stream broke");
  });

  it("should detect truncation when finishReason is length", async () => {
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

    let completedMeta: any = null;

    await clientResult.value.generateStream("test", {
      onChunk: () => {},
      onComplete: (_text, meta) => { completedMeta = meta; },
      onError: () => {},
    });

    expect(completedMeta.truncated).toBe(true);
    expect(completedMeta.finishReason).toBe("length");
  });

  it("should skip empty chunks", async () => {
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
      onChunk: (chunk) => { receivedChunks.push(chunk); },
      onComplete: (text) => { completedText = text; },
      onError: () => {},
    });

    expect(receivedChunks).toEqual(["hello", "world"]);
    expect(completedText).toBe("helloworld");
  });
});
