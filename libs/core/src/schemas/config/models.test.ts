import { describe, expect, it } from "vitest";
import * as models from "./models.js";
import {
  OpenRouterModelCacheSchema,
  OpenRouterModelSchema,
  ProviderModelsResponseSchema,
} from "./models.js";

describe("schemas/config/models exports", () => {
  it("no longer exports the hand-maintained Gemini/GLM constants", () => {
    expect("GEMINI_MODELS" in models).toBe(false);
    expect("GEMINI_MODEL_INFO" in models).toBe(false);
    expect("GLM_MODELS" in models).toBe(false);
    expect("GLM_MODEL_INFO" in models).toBe(false);
  });

  it.each([
    "live",
    "cache",
    "snapshot",
  ] as const)("accepts provider model provenance from %s", (source) => {
    const fetchedAt = "2026-06-02T00:00:00.000Z";
    const result = ProviderModelsResponseSchema.safeParse({
      models: [],
      fetchedAt,
      source,
      cached: source === "cache",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toMatchObject({ source, fetchedAt });
  });

  it("keeps the OpenRouter schemas for the live OpenRouter path", () => {
    const model = OpenRouterModelSchema.safeParse({
      id: "openai/gpt-4o",
      name: "GPT-4o",
      contextLength: 128000,
      maxCompletionTokens: 16384,
      pricing: { prompt: "0", completion: "0" },
      isFree: false,
    });
    expect(model.success).toBe(true);
    if (model.success) expect(model.data.maxCompletionTokens).toBe(16384);
    expect(
      OpenRouterModelCacheSchema.safeParse({ models: [], fetchedAt: new Date().toISOString() })
        .success,
    ).toBe(true);
  });
});
