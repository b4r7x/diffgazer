import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadCreate, setupClientTestHome, teardownClientTestHome } from "./client-test-env.js";

// Boundary mock: `ai` is the Vercel AI SDK external HTTP client; tests provide canned generateText output.
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: vi.fn(),
}));

// Boundary mock: @ai-sdk/google is the Google Generative AI external HTTP client; tests provide a no-op model factory.
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn(() => ({}))),
}));

// Boundary mock: @ai-sdk/openai-compatible is the OpenAI-compatible external HTTP client (groq).
vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn(() => ({
    chatModel: vi.fn(() => ({ doGenerate: vi.fn(), doStream: vi.fn() })),
  })),
}));

describe("classifyError (via generate)", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  it.each([
    { providerMessage: "exceeded your current quota", expectedCode: "RATE_LIMITED" },
    { providerMessage: "401 Unauthorized: invalid_api_key", expectedCode: "API_KEY_INVALID" },
    { providerMessage: "429 too many requests", expectedCode: "RATE_LIMITED" },
    { providerMessage: "fetch failed: ECONNREFUSED", expectedCode: "NETWORK_ERROR" },
  ])('maps provider error "$providerMessage" to $expectedCode', async ({
    providerMessage,
    expectedCode,
  }) => {
    const { generateText } = await import("ai");
    vi.mocked(generateText).mockRejectedValue(new Error(providerMessage));

    const { createAIClient } = await loadCreate();
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
    const { generateText } = await import("ai");
    vi.mocked(generateText).mockRejectedValue(new Error("something unexpected happened"));

    const { createAIClient } = await loadCreate();
    const clientResult = createAIClient({ apiKey: "key", provider: "gemini" });
    expect(clientResult.ok).toBe(true);
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
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  it("clamps maxOutputTokens to the model's documented output limit", async () => {
    const { generateText } = await import("ai");
    vi.mocked(generateText).mockResolvedValue({ output: { x: "ok" } } as never);

    const { createAIClient } = await loadCreate();
    const clientResult = createAIClient({
      apiKey: "key",
      provider: "groq",
      model: "some-model",
      outputLimit: 8192,
    });
    expect(clientResult.ok).toBe(true);
    if (!clientResult.ok) return;

    const { z } = await import("zod");
    await clientResult.value.generate("test", z.object({ x: z.string() }));

    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({ maxOutputTokens: 8192 }));
  });

  it("refuses a prompt that exceeds the model's context window with a named-limit message", async () => {
    const { generateText } = await import("ai");

    const { createAIClient } = await loadCreate();
    const clientResult = createAIClient({
      apiKey: "key",
      provider: "groq",
      model: "tiny-context-model",
      outputLimit: 4096,
      contextLimit: 8192,
    });
    expect(clientResult.ok).toBe(true);
    if (!clientResult.ok) return;

    const { z } = await import("zod");
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
    expect(generateText).not.toHaveBeenCalled();
  });
});

describe("generate response recovery", () => {
  beforeEach(setupClientTestHome);
  afterEach(teardownClientTestHome);

  const reviewSchema = (z: typeof import("zod").z) =>
    z.object({
      summary: z.string(),
      issues: z.array(z.object({ id: z.string(), line: z.number().int().positive() })),
    });

  it("salvages valid issues when one issue fails strict validation", async () => {
    const { generateText, NoObjectGeneratedError } = await import("ai");
    const rawText = JSON.stringify({
      summary: "ok",
      issues: [
        { id: "a", line: 10 },
        { id: "b", line: -1 },
        { id: "c", line: 20 },
      ],
    });
    vi.mocked(generateText).mockRejectedValue(
      new NoObjectGeneratedError({
        message: "No object generated: response did not match schema.",
        text: rawText,
        response: {} as never,
        usage: {} as never,
        finishReason: "stop",
      }),
    );

    const { createAIClient } = await loadCreate();
    const clientResult = createAIClient({ apiKey: "key", provider: "gemini" });
    expect(clientResult.ok).toBe(true);
    if (!clientResult.ok) return;

    const { z } = await import("zod");
    const result = await clientResult.value.generate("test", reviewSchema(z));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.issues.map((i) => i.id)).toEqual(["a", "c"]);
    }
  });

  it("salvages valid issues when the response is truncated but the raw text still validates", async () => {
    const { generateText } = await import("ai");
    const rawText = JSON.stringify({
      summary: "ok",
      issues: [
        { id: "a", line: 10 },
        { id: "b", line: -1 },
      ],
    });
    vi.mocked(generateText).mockResolvedValue({
      finishReason: "length",
      text: rawText,
      get output(): never {
        throw new Error("output must not be accessed when finishReason is length");
      },
    } as never);

    const { createAIClient } = await loadCreate();
    const clientResult = createAIClient({ apiKey: "key", provider: "gemini" });
    expect(clientResult.ok).toBe(true);
    if (!clientResult.ok) return;

    const { z } = await import("zod");
    const result = await clientResult.value.generate("test", reviewSchema(z));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.issues.map((i) => i.id)).toEqual(["a"]);
    }
  });

  it("reports the output limit when the response was truncated and unsalvageable", async () => {
    const { generateText } = await import("ai");
    vi.mocked(generateText).mockResolvedValue({
      finishReason: "length",
      text: '{"summary":"partial","issues":[{"id":"a","li',
      get output(): never {
        throw new Error("output must not be accessed when finishReason is length");
      },
    } as never);

    const { createAIClient } = await loadCreate();
    const clientResult = createAIClient({ apiKey: "key", provider: "gemini" });
    expect(clientResult.ok).toBe(true);
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
