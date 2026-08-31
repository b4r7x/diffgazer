import { describe, expect, expectTypeOf, it } from "vitest";
import {
  type ConfigurationModelsResponse,
  ConfigurationModelsResponseSchema,
  ModelTierSchema,
  type ProviderModelsResponse,
  ProviderModelsResponseSchema,
} from "./models.js";

describe("schemas/config/models", () => {
  it.each([
    "free",
    "paid",
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
    "provider-live",
    "provider-cache",
  ] as const)("accepts provider model provenance from %s", (source) => {
    const fetchedAt = "2026-06-02T00:00:00.000Z";
    const result = ProviderModelsResponseSchema.safeParse({
      models: [],
      fetchedAt,
      source,
      cached: source === "cache" || source === "provider-cache",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toMatchObject({ source, fetchedAt });
  });

  it.each([
    { source: "live", cached: true },
    { source: "snapshot", cached: true },
    { source: "cache", cached: false },
    { source: "provider-live", cached: true },
    { source: "provider-cache", cached: false },
  ] as const)("rejects the contradictory pair source=$source cached=$cached", (provenance) => {
    expect(
      ProviderModelsResponseSchema.safeParse({
        models: [],
        fetchedAt: "2026-06-02T00:00:00.000Z",
        ...provenance,
      }).success,
    ).toBe(false);
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

  it("parses a model row with endpointProfileIds and round-trips the field", () => {
    const result = ProviderModelsResponseSchema.safeParse({
      models: [
        {
          id: "deepseek-v4-flash",
          name: "DeepSeek V4 Flash",
          description: "d",
          tier: "paid",
          endpointProfileIds: ["zen", "go"],
        },
      ],
      fetchedAt: "2026-06-02T00:00:00.000Z",
      source: "live",
      cached: false,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.models[0]?.endpointProfileIds).toEqual(["zen", "go"]);
    }
  });

  it.each([
    { name: "empty membership list", endpointProfileIds: [] },
    { name: "blank profile id", endpointProfileIds: [""] },
  ])("rejects a model row whose endpointProfileIds is not real membership: $name", (row) => {
    const result = ProviderModelsResponseSchema.safeParse({
      models: [
        {
          id: "m",
          name: "M",
          description: "d",
          tier: "paid",
          endpointProfileIds: row.endpointProfileIds,
        },
      ],
      fetchedAt: "2026-06-02T00:00:00.000Z",
      source: "live",
      cached: false,
    });

    expect(result.success).toBe(false);
  });

  it("parses a model row without endpointProfileIds (today's shape)", () => {
    const result = ProviderModelsResponseSchema.safeParse({
      models: [{ id: "m", name: "M", description: "d", tier: "paid" }],
      fetchedAt: "2026-06-02T00:00:00.000Z",
      source: "live",
      cached: false,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.models[0]).not.toHaveProperty("endpointProfileIds");
    }
  });

  it("makes a contradictory source/cached pair unrepresentable in the exported type", () => {
    type CachedFor<Source extends ProviderModelsResponse["source"]> = Extract<
      ProviderModelsResponse,
      { source: Source }
    >["cached"];

    expectTypeOf<CachedFor<"live">>().toEqualTypeOf<false>();
    expectTypeOf<CachedFor<"cache">>().toEqualTypeOf<true>();
    expectTypeOf<CachedFor<"snapshot">>().toEqualTypeOf<false>();
    expectTypeOf<CachedFor<"provider-live">>().toEqualTypeOf<false>();
    expectTypeOf<CachedFor<"provider-cache">>().toEqualTypeOf<true>();
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
    configurationId: "opencode-zen-primary",
    productId: "opencode-zen",
    transportFamily: "hosted-api",
    models: [],
    checkedAt: "2026-08-02T00:00:00.000Z",
    reason:
      "The catalog lists no model this product's model policy admits. Configure a different provider to run reviews.",
  };

  it.each([
    "live",
    "cache",
    "snapshot",
    "provider-live",
    "provider-cache",
  ] as const)("accepts passed catalog provenance from %s", (source) => {
    const result = ConfigurationModelsResponseSchema.safeParse({
      ...passed,
      source,
      cached: source === "cache" || source === "provider-cache",
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
    { source: "provider-live", cached: true },
    { source: "provider-cache", cached: false },
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

  it("types skipped results as carrying no models and passed results as provenance-bound", () => {
    expectTypeOf<
      Extract<ConfigurationModelsResponse, { status: "skipped" }>["models"]
    >().toEqualTypeOf<[]>();
    expectTypeOf<
      Extract<ConfigurationModelsResponse, { source: "cache" }>["cached"]
    >().toEqualTypeOf<true>();
  });
});
