import { describe, expect, it } from "vitest";
import {
  ConfigurationModelsResponseSchema,
  ModelTierSchema,
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
    "free",
    "paid",
    "local",
    "ambient",
  ] as const)("accepts the %s model tier without inferring billing", (tier) => {
    expect(ModelTierSchema.safeParse(tier).success).toBe(true);
    const result = ProviderModelsResponseSchema.safeParse({
      models: [{ id: "m", name: "M", description: "d", tier }],
      fetchedAt: "2026-06-02T00:00:00.000Z",
      source: "live",
      cached: false,
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.models[0]?.tier).toBe(tier);
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

  it.each([
    { source: "live", cached: true },
    { source: "snapshot", cached: true },
    { source: "cache", cached: false },
  ] as const)("rejects the contradictory pair source=$source cached=$cached", (provenance) => {
    expect(
      ProviderModelsResponseSchema.safeParse({
        models: [],
        fetchedAt: "2026-06-02T00:00:00.000Z",
        ...provenance,
      }).success,
    ).toBe(false);
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

describe("ConfigurationModelsResponseSchema", () => {
  const passed = {
    status: "passed",
    configurationId: "cfg-v1-zai",
    productId: "zai",
    transportFamily: "hosted-api",
    models: [{ id: "glm-4.7", name: "GLM-4.7", description: "128K context", tier: "paid" }],
    checkedAt: "2026-08-02T00:00:00.000Z",
    source: "snapshot",
    cached: false,
  };
  const skipped = {
    status: "skipped",
    configurationId: "ollama-loopback",
    productId: "ollama",
    transportFamily: "local-http",
    models: [],
    checkedAt: "2026-08-02T00:00:00.000Z",
    reason: "Catalog observations are unavailable for this configuration product.",
  };

  it.each([
    "live",
    "cache",
    "snapshot",
  ] as const)("accepts passed catalog provenance from %s", (source) => {
    const result = ConfigurationModelsResponseSchema.safeParse({
      ...passed,
      source,
      cached: source === "cache",
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.status === "passed") {
      expect(result.data.models[0]?.id).toBe("glm-4.7");
    }
  });

  it.each([
    { source: "live", cached: true },
    { source: "snapshot", cached: true },
    { source: "cache", cached: false },
  ] as const)("rejects contradictory provenance source=$source cached=$cached", (provenance) => {
    expect(ConfigurationModelsResponseSchema.safeParse({ ...passed, ...provenance }).success).toBe(
      false,
    );
  });

  it("accepts a skipped response with an empty model list and a bounded reason", () => {
    const result = ConfigurationModelsResponseSchema.safeParse(skipped);
    expect(result.success).toBe(true);
    if (result.success && result.data.status === "skipped") {
      expect(result.data.reason).toBe(skipped.reason);
    }
  });

  it.each([
    { name: "skipped with models", input: { ...skipped, models: passed.models } },
    { name: "skipped with an empty reason", input: { ...skipped, reason: "" } },
    { name: "skipped with an oversize reason", input: { ...skipped, reason: "x".repeat(513) } },
    { name: "unknown status", input: { ...passed, status: "pending" } },
    { name: "passed with an extra key", input: { ...passed, credential: "sk-leak" } },
    { name: "passed without provenance", input: { ...passed, source: undefined } },
  ])("rejects $name", ({ input }) => {
    expect(ConfigurationModelsResponseSchema.safeParse(input).success).toBe(false);
  });
});
