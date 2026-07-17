import type { ProviderWithStatus } from "@diffgazer/core/schemas/config";
import { describe, expect, it } from "vitest";
import { filterProviders, findProviderById, PROVIDER_FILTERS } from "./filter";

const PROVIDERS: ProviderWithStatus[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    hasApiKey: true,
    isActive: true,
    model: "gemini-2.5-flash",
    displayStatus: "active",
  },
  {
    id: "zai",
    name: "Z.AI",
    defaultModel: "glm-4.7",
    hasApiKey: true,
    isActive: false,
    displayStatus: "configured",
  },
  {
    id: "zai-coding",
    name: "Z.AI Coding Plan",
    defaultModel: "glm-4.7",
    hasApiKey: false,
    isActive: false,
    displayStatus: "needs-key",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    defaultModel: "",
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
    expect(ids(filterProviders(PROVIDERS, "needs-key"))).toEqual(["zai-coding", "openrouter"]);
  });

  it("filters 'free' to providers with a curated free tier", () => {
    const result = ids(filterProviders(PROVIDERS, "free"));
    expect(result).toContain("gemini");
    expect(result).toContain("zai");
    expect(result).toContain("openrouter");
    expect(result).not.toContain("zai-coding");
  });

  it("filters 'paid' to providers without a curated free tier", () => {
    expect(ids(filterProviders(PROVIDERS, "paid"))).toEqual(["zai-coding"]);
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

  it("resolves a dialog owner from the canonical list after filtering removes it", () => {
    const filtered = filterProviders(PROVIDERS, "needs-key").map((provider) =>
      provider.id === "openrouter" ? { ...provider, hasApiKey: true } : provider,
    );
    const refreshedFiltered = filterProviders(filtered, "needs-key");

    expect(findProviderById(refreshedFiltered, "openrouter")).toBeNull();
    expect(findProviderById(PROVIDERS, "openrouter")?.name).toBe("OpenRouter");
  });
});
