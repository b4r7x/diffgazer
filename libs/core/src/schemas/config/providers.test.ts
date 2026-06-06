import { describe, expect, it } from "vitest";
import { AI_PROVIDERS, AIProviderSchema, UserConfigSchema } from "./providers.js";

const now = new Date().toISOString();
const baseConfig = {
  provider: "gemini" as const,
  createdAt: now,
  updatedAt: now,
};

describe("UserConfigSchema refine — model/provider validation", () => {
  it.each<{
    name: string;
    overrides: Record<string, unknown>;
    success: boolean;
  }>([
    { name: "gemini with a known gemini model", overrides: { model: "gemini-2.5-flash" }, success: true },
    { name: "gemini with a fresh (catalog-supplied) id", overrides: { model: "gemini-3-pro" }, success: true },
    { name: "zai with a fresh GLM id", overrides: { provider: "zai", model: "glm-5.1" }, success: true },
    { name: "zai-coding with a GLM id", overrides: { provider: "zai-coding", model: "glm-4.7" }, success: true },
    { name: "openrouter with arbitrary model id", overrides: { provider: "openrouter", model: "any-model-id/whatever" }, success: true },
    { name: "groq with a fresh id", overrides: { provider: "groq", model: "meta-llama/llama-4-scout-17b-16e-instruct" }, success: true },
    { name: "cerebras with a fresh id", overrides: { provider: "cerebras", model: "gpt-oss-120b" }, success: true },
    { name: "any provider with model omitted", overrides: {}, success: true },
    { name: "any provider with an empty model string", overrides: { model: "" }, success: false },
    { name: "any provider with a whitespace-only model string", overrides: { model: "   " }, success: false },
  ])("$name → success=$success", ({ overrides, success }) => {
    const result = UserConfigSchema.safeParse({ ...baseConfig, ...overrides });

    expect(result.success).toBe(success);
  });
});

describe("AI_PROVIDERS enum membership", () => {
  it("includes the four original providers plus groq and cerebras", () => {
    expect([...AI_PROVIDERS]).toEqual([
      "gemini",
      "zai",
      "zai-coding",
      "openrouter",
      "groq",
      "cerebras",
    ]);
  });

  it("parses groq and cerebras as valid providers", () => {
    expect(AIProviderSchema.safeParse("groq").success).toBe(true);
    expect(AIProviderSchema.safeParse("cerebras").success).toBe(true);
  });

  it("rejects an unknown provider id", () => {
    expect(AIProviderSchema.safeParse("anthropic").success).toBe(false);
  });
});
