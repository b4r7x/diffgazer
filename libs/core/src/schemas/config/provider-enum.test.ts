import { describe, it, expect } from "vitest";
import { AI_PROVIDERS, AIProviderSchema } from "./providers.js";

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
