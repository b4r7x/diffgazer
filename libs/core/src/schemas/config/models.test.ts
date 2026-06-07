import { describe, expect, it } from "vitest";
import * as models from "./models.js";
import { OpenRouterModelCacheSchema, OpenRouterModelSchema } from "./models.js";

describe("schemas/config/models exports", () => {
  it("no longer exports the hand-maintained Gemini/GLM constants", () => {
    expect("GEMINI_MODELS" in models).toBe(false);
    expect("GEMINI_MODEL_INFO" in models).toBe(false);
    expect("GLM_MODELS" in models).toBe(false);
    expect("GLM_MODEL_INFO" in models).toBe(false);
  });

  it("keeps the OpenRouter schemas for the live OpenRouter path", () => {
    expect(
      OpenRouterModelSchema.safeParse({
        id: "openai/gpt-4o",
        name: "GPT-4o",
        contextLength: 128000,
        pricing: { prompt: "0", completion: "0" },
        isFree: false,
      }).success,
    ).toBe(true);
    expect(
      OpenRouterModelCacheSchema.safeParse({ models: [], fetchedAt: new Date().toISOString() })
        .success,
    ).toBe(true);
  });
});
