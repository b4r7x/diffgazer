import { describe, expect, it } from "vitest";
import {
  OpenRouterModelCacheSchema,
  OpenRouterModelSchema,
  OpenRouterModelsResponseSchema,
  ProviderModelsResponseSchema,
} from "./models.js";

const validOpenRouterModel = {
  id: "openai/gpt-4o",
  name: "GPT-4o",
  contextLength: 128000,
  pricing: { prompt: "0", completion: "0" },
  isFree: false,
};

describe("schemas/config/models", () => {
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
      ...validOpenRouterModel,
      maxCompletionTokens: 16384,
    });
    expect(model.success).toBe(true);
    if (model.success) expect(model.data.maxCompletionTokens).toBe(16384);
    expect(
      OpenRouterModelCacheSchema.safeParse({ models: [], fetchedAt: new Date().toISOString() })
        .success,
    ).toBe(true);
  });

  it.each([
    { name: "missing id", input: { ...validOpenRouterModel, id: undefined } },
    {
      name: "non-numeric contextLength",
      input: { ...validOpenRouterModel, contextLength: "128000" },
    },
    { name: "non-boolean isFree", input: { ...validOpenRouterModel, isFree: "false" } },
    { name: "missing pricing", input: { ...validOpenRouterModel, pricing: undefined } },
    {
      name: "non-positive maxCompletionTokens",
      input: { ...validOpenRouterModel, maxCompletionTokens: 0 },
    },
  ])("rejects a malformed OpenRouter model field: $name", ({ input }) => {
    expect(OpenRouterModelSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    { name: "invalid fetchedAt", input: { models: [], fetchedAt: "not-a-date" } },
    {
      name: "invalid model member",
      input: {
        models: [{ ...validOpenRouterModel, id: undefined }],
        fetchedAt: new Date().toISOString(),
      },
    },
  ])("rejects an invalid OpenRouter model cache: $name", ({ input }) => {
    expect(OpenRouterModelCacheSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    {
      name: "invalid model member",
      input: {
        models: [{ ...validOpenRouterModel, id: undefined }],
        fetchedAt: new Date().toISOString(),
        cached: false,
      },
    },
    {
      name: "non-boolean cached",
      input: {
        models: [validOpenRouterModel],
        fetchedAt: new Date().toISOString(),
        cached: "false",
      },
    },
    {
      name: "invalid fetchedAt",
      input: { models: [validOpenRouterModel], fetchedAt: "not-a-date", cached: false },
    },
  ])("rejects an invalid OpenRouter models response member: $name", ({ input }) => {
    expect(OpenRouterModelsResponseSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    {
      name: "invalid provenance",
      input: {
        models: [],
        fetchedAt: "2026-06-02T00:00:00.000Z",
        source: "manual",
        cached: false,
      },
    },
    {
      name: "invalid model tier",
      input: {
        models: [{ id: "m", name: "M", description: "d", tier: "premium" }],
        fetchedAt: "2026-06-02T00:00:00.000Z",
        source: "live",
        cached: false,
      },
    },
  ])("rejects invalid provider provenance/model tiers: $name", ({ input }) => {
    expect(ProviderModelsResponseSchema.safeParse(input).success).toBe(false);
  });
});
