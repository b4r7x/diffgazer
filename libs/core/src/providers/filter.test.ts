import { describe, it, expect } from "vitest";
import type { ProviderWithStatus } from "@diffgazer/core/schemas/config";
import { PROVIDER_FILTERS, filterProviders } from "./filter";

const PROVIDERS: ProviderWithStatus[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash"],
    hasApiKey: true,
    isActive: true,
    model: "gemini-2.5-flash",
    displayStatus: "active",
  },
  {
    id: "zai",
    name: "Z.AI",
    defaultModel: "glm-4.7",
    models: ["glm-4.7"],
    hasApiKey: true,
    isActive: false,
    displayStatus: "configured",
  },
  {
    id: "zai-coding",
    name: "Z.AI Coding Plan",
    defaultModel: "glm-4.7",
    models: ["glm-4.7"],
    hasApiKey: false,
    isActive: false,
    displayStatus: "needs-key",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    defaultModel: "",
    models: [],
    hasApiKey: false,
    isActive: false,
    displayStatus: "needs-key",
  },
];

const ids = (providers: ProviderWithStatus[]) => providers.map((p) => p.id);

describe("filterProviders", () => {
  it("returns all providers when filter is 'all'", () => {
    expect(ids(filterProviders(PROVIDERS, "all"))).toEqual([
      "gemini",
      "zai",
      "zai-coding",
      "openrouter",
    ]);
  });

  it("filters to configured providers (hasApiKey)", () => {
    expect(ids(filterProviders(PROVIDERS, "configured"))).toEqual(["gemini", "zai"]);
  });

  it("filters to providers needing a key", () => {
    expect(ids(filterProviders(PROVIDERS, "needs-key"))).toEqual([
      "zai-coding",
      "openrouter",
    ]);
  });

  it("filters by free tier (includes mixed-tier providers)", () => {
    const result = ids(filterProviders(PROVIDERS, "free"));
    expect(result).toContain("gemini");
    expect(result).toContain("zai");
    expect(result).not.toContain("zai-coding");
  });

  it("filters by paid tier (excludes free and mixed)", () => {
    const result = ids(filterProviders(PROVIDERS, "paid"));
    expect(result).toContain("zai-coding");
    expect(result).not.toContain("gemini");
    expect(result).not.toContain("zai");
  });

  it("matches search query against name and id", () => {
    expect(ids(filterProviders(PROVIDERS, "all", "google"))).toEqual(["gemini"]);
    expect(ids(filterProviders(PROVIDERS, "all", "zai"))).toEqual(["zai", "zai-coding"]);
  });

  it("combines filter and search", () => {
    expect(ids(filterProviders(PROVIDERS, "configured", "google"))).toEqual(["gemini"]);
  });

  it("trims whitespace from search query", () => {
    expect(ids(filterProviders(PROVIDERS, "all", "  google  "))).toEqual(["gemini"]);
  });

  it("exposes the canonical PROVIDER_FILTERS tuple", () => {
    expect(PROVIDER_FILTERS).toEqual(["all", "configured", "needs-key", "free", "paid"]);
  });
});
