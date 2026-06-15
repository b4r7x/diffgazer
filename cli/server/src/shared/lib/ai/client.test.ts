import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { AI_PROVIDERS } from "@diffgazer/core/schemas/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const keyring = vi.hoisted(() => ({
  deleteKeyringSecret: vi.fn(),
  isKeyringAvailable: vi.fn(),
  readKeyringSecret: vi.fn(),
  writeKeyringSecret: vi.fn(),
}));

// Boundary mock: keyring wraps the OS keychain via @napi-rs/keyring; tests provide canned secret read/write results.
vi.mock("../config/keyring.js", () => keyring);

// Boundary mock: `ai` is the Vercel AI SDK external HTTP client; tests provide canned generateObject output.
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateObject: vi.fn(),
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

describe("generate output budget", () => {
  beforeEach(setupTempHome);
  afterEach(teardownTempHome);

  it("clamps maxOutputTokens to the model's documented output limit", async () => {
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockResolvedValue({ object: { x: "ok" } } as never);

    const { createAIClient } = await loadClient();
    const clientResult = createAIClient({
      apiKey: "key",
      provider: "groq",
      model: "some-model",
      outputLimit: 8192,
    });
    if (!clientResult.ok) return;

    const { z } = await import("zod");
    await clientResult.value.generate("test", z.object({ x: z.string() }));

    expect(generateObject).toHaveBeenCalledWith(expect.objectContaining({ maxOutputTokens: 8192 }));
  });

  it("initializeAIClient threads the active model's snapshot limit into the request", async () => {
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockResolvedValue({ object: { x: "ok" } } as never);

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

    const { initializeAIClient } = await loadClient();
    const clientResult = initializeAIClient();
    expect(clientResult.ok).toBe(true);
    if (!clientResult.ok) return;

    const { z } = await import("zod");
    await clientResult.value.generate("test", z.object({ x: z.string() }));

    // The groq scout model's snapshot output limit is 8192, well below the 65536 default.
    expect(generateObject).toHaveBeenCalledWith(expect.objectContaining({ maxOutputTokens: 8192 }));
  });

  it("refuses a prompt that exceeds the model's context window with a named-limit message", async () => {
    const { generateObject } = await import("ai");

    const { createAIClient } = await loadClient();
    const clientResult = createAIClient({
      apiKey: "key",
      provider: "groq",
      model: "tiny-context-model",
      outputLimit: 4096,
      contextLimit: 8192,
    });
    if (!clientResult.ok) return;

    const { z } = await import("zod");
    // A prompt of ~5000 tokens plus the 4096 output budget exceeds the 8192 context window.
    const result = await clientResult.value.generate(
      "x".repeat(20_000),
      z.object({ x: z.string() }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MODEL_ERROR");
      expect(result.error.message).toContain("tiny-context-model");
      expect(result.error.message).toContain("8192");
    }
    expect(generateObject).not.toHaveBeenCalled();
  });
});

describe("generate response recovery", () => {
  beforeEach(setupTempHome);
  afterEach(teardownTempHome);

  const reviewSchema = (z: typeof import("zod").z) =>
    z.object({
      summary: z.string(),
      issues: z.array(z.object({ id: z.string(), line: z.number().int().positive() })),
    });

  it("salvages valid issues when one issue fails strict validation", async () => {
    const { generateObject, NoObjectGeneratedError } = await import("ai");
    const rawText = JSON.stringify({
      summary: "ok",
      issues: [
        { id: "a", line: 10 },
        { id: "b", line: -1 },
        { id: "c", line: 20 },
      ],
    });
    vi.mocked(generateObject).mockRejectedValue(
      new NoObjectGeneratedError({
        message: "No object generated: response did not match schema.",
        text: rawText,
        response: {} as never,
        usage: {} as never,
        finishReason: "stop",
      }),
    );

    const { createAIClient } = await loadClient();
    const clientResult = createAIClient({ apiKey: "key", provider: "gemini" });
    if (!clientResult.ok) return;

    const { z } = await import("zod");
    const result = await clientResult.value.generate("test", reviewSchema(z));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.issues.map((i) => i.id)).toEqual(["a", "c"]);
    }
  });

  it("reports the output limit when the response was truncated (finishReason length)", async () => {
    const { generateObject, NoObjectGeneratedError } = await import("ai");
    vi.mocked(generateObject).mockRejectedValue(
      new NoObjectGeneratedError({
        message: "No object generated: could not parse the response.",
        text: '{"summary":"partial","issues":[{"id":"a","li',
        response: {} as never,
        usage: {} as never,
        finishReason: "length",
      }),
    );

    const { createAIClient } = await loadClient();
    const clientResult = createAIClient({ apiKey: "key", provider: "gemini" });
    if (!clientResult.ok) return;

    const { z } = await import("zod");
    const result = await clientResult.value.generate("test", reviewSchema(z));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MODEL_ERROR");
      expect(result.error.message).toMatch(/cut off|output limit/i);
    }
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
