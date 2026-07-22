import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const keyring = vi.hoisted(() => ({
  deleteKeyringSecret: vi.fn(),
  isKeyringAvailable: vi.fn(),
  readKeyringSecret: vi.fn(),
  writeKeyringSecret: vi.fn(),
}));

const modelsDevCatalog = vi.hoisted(() => ({
  getProviderModels: vi.fn(),
}));

const openRouterCatalog = vi.hoisted(() => ({
  getOpenRouterModelsWithCache: vi.fn(),
}));

// Boundary mock: keyring wraps the OS keychain via @napi-rs/keyring; tests provide canned secret read/write results.
vi.mock("../../config/keyring.js", () => keyring);
vi.mock("../models-dev-catalog.js", () => modelsDevCatalog);
vi.mock("../openrouter-models.js", () => openRouterCatalog);

// Boundary mock: `ai` is the Vercel AI SDK external HTTP client; tests provide canned generateText output.
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: vi.fn(),
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



function setupTempHome() {
  diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-ai-client-"));
  process.env.DIFFGAZER_HOME = diffgazerHome;
  vi.resetModules();
  vi.clearAllMocks();
  keyring.isKeyringAvailable.mockReturnValue(true);
  keyring.readKeyringSecret.mockReturnValue({ ok: true, value: null });
  modelsDevCatalog.getProviderModels.mockResolvedValue({
    models: [],
    fetchedAt: new Date().toISOString(),
    source: "live",
    cached: false,
  });
  openRouterCatalog.getOpenRouterModelsWithCache.mockResolvedValue({
    ok: true,
    value: { models: [], fetchedAt: new Date().toISOString(), cached: false },
  });
}

function teardownTempHome() {
  vi.restoreAllMocks();
  delete process.env.DIFFGAZER_HOME;
  rmSync(diffgazerHome, { recursive: true, force: true });
}

async function loadInitialize() {
  return import("./initialize.js");
}
describe("initializeAIClient", () => {
  beforeEach(() => {
    setupTempHome();
    keyring.writeKeyringSecret.mockReturnValue({ ok: true, value: undefined });
    keyring.deleteKeyringSecret.mockReturnValue({ ok: true, value: false });
  });

  afterEach(teardownTempHome);

  it("reports UNSUPPORTED_PROVIDER when no provider is active", async () => {
    // No config file written — store has no active provider
    const { initializeAIClient } = await loadInitialize();
    const result = await initializeAIClient();

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

    const { initializeAIClient } = await loadInitialize();
    const result = await initializeAIClient();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MODEL_ERROR");
    }
  });

  it("preserves KEYRING_READ_FAILED when the configured credential cannot be read", async () => {
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

    const { initializeAIClient } = await loadInitialize();
    const result = await initializeAIClient();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ code: "KEYRING_READ_FAILED", message: "keyring error" });
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

    const { initializeAIClient } = await loadInitialize();
    const result = await initializeAIClient();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("API_KEY_MISSING");
    }
  });

  it("returns a usable client with a non-secret execution fingerprint", async () => {
    const apiKey = "test-api-key";
    writeJson(join(diffgazerHome, "config.json"), {
      settings: { secretsStorage: "file" },
      providers: [
        { provider: "gemini", hasApiKey: true, isActive: true, model: "gemini-2.5-flash" },
      ],
    });
    writeJson(join(diffgazerHome, "secrets.json"), { providers: { gemini: apiKey } });

    const { initializeAIClient } = await loadInitialize();
    const result = await initializeAIClient();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.provider).toBe("gemini");
      expect(result.value.executionFingerprint).toStrictEqual({
        provider: "gemini",
        model: "gemini-2.5-flash",
      });
      expect(JSON.stringify(result.value.executionFingerprint)).not.toContain(apiKey);
    }
  });
});

describe("initializeAIClient model limits", () => {
  beforeEach(setupTempHome);
  afterEach(teardownTempHome);
  it("falls back to the snapshot when the active model is absent from current catalog data", async () => {
    const { generateText } = await import("ai");
    vi.mocked(generateText).mockResolvedValue({ output: { x: "ok" } } as never);

    writeJson(join(diffgazerHome, "config.json"), {
      settings: { secretsStorage: "file" },
      providers: [
        {
          provider: "groq",
          hasApiKey: true,
          isActive: true,
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
        },
      ],
    });
    writeJson(join(diffgazerHome, "secrets.json"), { providers: { groq: "test-key" } });

    const { initializeAIClient } = await loadInitialize();
    const clientResult = await initializeAIClient();
    expect(clientResult.ok).toBe(true);
    if (!clientResult.ok) return;

    const { z } = await import("zod");
    await clientResult.value.generate("test", z.object({ x: z.string() }));

    // The groq scout model's snapshot output limit is 8192, well below the 65536 default.
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({ maxOutputTokens: 8192 }));
  });

  it("uses live-only model limits for generation and context preflight", async () => {
    const { generateText } = await import("ai");
    vi.mocked(generateText).mockResolvedValue({ output: { x: "ok" } } as never);
    modelsDevCatalog.getProviderModels.mockResolvedValue({
      models: [
        {
          id: "live-only-model",
          name: "Live Only",
          description: "Live model",
          tier: "paid",
          contextLength: 8192,
          maxOutputTokens: 4096,
        },
      ],
      fetchedAt: new Date().toISOString(),
      source: "cache",
      cached: true,
    });
    writeJson(join(diffgazerHome, "config.json"), {
      settings: { secretsStorage: "file" },
      providers: [
        {
          provider: "groq",
          hasApiKey: true,
          isActive: true,
          model: "live-only-model",
        },
      ],
    });
    writeJson(join(diffgazerHome, "secrets.json"), { providers: { groq: "test-key" } });

    const { initializeAIClient } = await loadInitialize();
    const clientResult = await initializeAIClient();
    expect(clientResult.ok).toBe(true);
    if (!clientResult.ok) return;

    const { z } = await import("zod");
    await clientResult.value.generate("test", z.object({ x: z.string() }));
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({ maxOutputTokens: 4096 }));

    vi.mocked(generateText).mockClear();
    const oversized = await clientResult.value.generate(
      "x".repeat(20_000),
      z.object({ x: z.string() }),
    );
    expect(oversized.ok).toBe(false);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("does not replace a current model's missing limits with snapshot limits", async () => {
    const { generateText } = await import("ai");
    vi.mocked(generateText).mockResolvedValue({ output: { x: "ok" } } as never);
    modelsDevCatalog.getProviderModels.mockResolvedValue({
      models: [
        {
          id: "meta-llama/llama-4-scout-17b-16e-instruct",
          name: "Current Scout",
          description: "Current catalog entry without limits",
          tier: "paid",
        },
      ],
      fetchedAt: new Date().toISOString(),
      source: "live",
      cached: false,
    });
    writeJson(join(diffgazerHome, "config.json"), {
      settings: { secretsStorage: "file" },
      providers: [
        {
          provider: "groq",
          hasApiKey: true,
          isActive: true,
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
        },
      ],
    });
    writeJson(join(diffgazerHome, "secrets.json"), { providers: { groq: "test-key" } });

    const { initializeAIClient } = await loadInitialize();
    const clientResult = await initializeAIClient();
    expect(clientResult.ok).toBe(true);
    if (!clientResult.ok) return;

    const { z } = await import("zod");
    await clientResult.value.generate("test", z.object({ x: z.string() }));

    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({ maxOutputTokens: 65536 }));
  });

  it("uses OpenRouter's current completion ceiling", async () => {
    const { generateText } = await import("ai");
    vi.mocked(generateText).mockResolvedValue({ output: { x: "ok" } } as never);
    openRouterCatalog.getOpenRouterModelsWithCache.mockResolvedValue({
      ok: true,
      value: {
        models: [
          {
            id: "vendor/current-model",
            name: "Current Model",
            contextLength: 16384,
            maxCompletionTokens: 2048,
            pricing: { prompt: "0", completion: "0" },
            isFree: true,
          },
        ],
        fetchedAt: new Date().toISOString(),
        cached: true,
      },
    });
    writeJson(join(diffgazerHome, "config.json"), {
      settings: { secretsStorage: "file" },
      providers: [
        {
          provider: "openrouter",
          hasApiKey: true,
          isActive: true,
          model: "vendor/current-model",
        },
      ],
    });
    writeJson(join(diffgazerHome, "secrets.json"), {
      providers: { openrouter: "test-key" },
    });

    const { initializeAIClient } = await loadInitialize();
    const clientResult = await initializeAIClient();
    expect(clientResult.ok).toBe(true);
    if (!clientResult.ok) return;

    const { z } = await import("zod");
    await clientResult.value.generate("test", z.object({ x: z.string() }));

    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({ maxOutputTokens: 2048 }));
  });
});
