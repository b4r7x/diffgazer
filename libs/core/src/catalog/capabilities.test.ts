import { describe, expect, it } from "vitest";
import { deriveCapabilities } from "./capabilities.js";
import { RAW_CATALOG } from "./fixtures.js";
import { parseModelsDevCatalog } from "./schema.js";

const catalog = parseModelsDevCatalog(RAW_CATALOG);

describe("deriveCapabilities", () => {
  it("returns the full ProviderCapabilities prose shape", () => {
    const caps = deriveCapabilities(catalog, "gemini");
    expect(caps).toMatchObject({
      toolCalling: expect.any(String),
      jsonMode: expect.any(String),
      streaming: expect.any(String),
      contextWindow: expect.any(String),
      costDescription: expect.any(String),
    });
    expect(["free", "paid", "mixed"]).toContain(caps.tier);
    expect(["FREE", "PAID"]).toContain(caps.tierBadge);
    expect(Array.isArray(caps.capabilities)).toBe(true);
  });

  it("reports the max limit.context across the provider's models", () => {
    const caps = deriveCapabilities(catalog, "gemini");
    expect(caps.contextWindow).toContain("1M");
  });

  it("sets tier 'mixed' when the provider has both free and paid models", () => {
    expect(deriveCapabilities(catalog, "gemini").tier).toBe("mixed");
  });

  it("derives tierBadge FREE from hasFreeTier true, PAID otherwise", () => {
    expect(deriveCapabilities(catalog, "gemini").tierBadge).toBe("FREE");
    expect(deriveCapabilities(catalog, "zai-coding").tierBadge).toBe("PAID");
  });

  it("derives capability flags from any model exposing tool_call / structured_output / reasoning", () => {
    const caps = deriveCapabilities(catalog, "gemini");
    expect(caps.capabilities).toContain("TOOLS");
    expect(caps.capabilities).toContain("JSON");
  });

  it("keeps the JSON capability when no model advertises structured_output (zai)", () => {
    // zai's fixture models carry no structured_output field, so the positive
    // hint is absent — the contract is that JSON is still offered, never gated.
    const zaiModels = Object.values(catalog.zai?.models ?? {});
    expect(zaiModels.length).toBeGreaterThan(0);
    expect(zaiModels.every((m) => m.structured_output !== true)).toBe(true);

    const caps = deriveCapabilities(catalog, "zai");

    expect(caps.capabilities).toContain("JSON");
    expect(caps.jsonMode).toMatch(/JSON/i);
  });

  it("resolves cerebras to the free tier via the 'all' selector with curated free-tier prose", () => {
    const caps = deriveCapabilities(catalog, "cerebras");

    expect(caps.tier).toBe("free");
    expect(caps.tierBadge).toBe("FREE");
    expect(caps.costDescription).toMatch(/^Cerebras free tier: ~1M tokens\/day\./);
  });

  it("resolves groq to the free tier via the 'all' selector despite priced models", () => {
    const caps = deriveCapabilities(catalog, "groq");

    expect(caps.tier).toBe("free");
    expect(caps.tierBadge).toBe("FREE");
  });

  it("resolves a paid-only provider (zai-coding) to tier 'paid' with paid cost prose", () => {
    const caps = deriveCapabilities(catalog, "zai-coding");

    expect(caps.tier).toBe("paid");
    expect(caps.costDescription).toMatch(/paid/i);
  });

  it("keeps tier consistent with the FREE badge when the provider has no models", () => {
    const empty = parseModelsDevCatalog({});

    // gemini has hasFreeTier:true; an empty model list must not flip tier to 'paid'
    // and contradict the FREE tierBadge.
    const caps = deriveCapabilities(empty, "gemini");
    expect(caps.tierBadge).toBe("FREE");
    expect(caps.tier).toBe("free");

    // zai-coding has hasFreeTier:false, so an empty list stays paid.
    expect(deriveCapabilities(empty, "zai-coding").tier).toBe("paid");
  });

  it("reports 'Varies by model' context when no model carries a context limit", () => {
    const noContext = parseModelsDevCatalog({
      google: { id: "google", models: { "gemini-2.5-flash": { id: "gemini-2.5-flash" } } },
    });

    expect(deriveCapabilities(noContext, "gemini").contextWindow).toBe("Varies by model");
  });

  it("upgrades jsonMode prose to structured-output wording only when a model advertises it", () => {
    // gemini's models set structured_output:true -> the upgraded wording.
    expect(deriveCapabilities(catalog, "gemini").jsonMode).toMatch(/structured output/i);
    // zai's models do not -> the plain fallback wording.
    expect(deriveCapabilities(catalog, "zai").jsonMode).toMatch(/where the model offers/i);
  });
});
