import { describe, it, expect } from "vitest";
import type { ModelInfo, OpenRouterModel } from "@diffgazer/core/schemas/config";
import {
  TIER_FILTERS,
  buildModels,
  cycleTierFilter,
  filterModels,
  getStaticModelsForProvider,
} from "./models";

const makeModel = (
  id: string,
  name: string,
  tier: "free" | "paid",
  description = "",
): ModelInfo => ({ id, name, tier, description });

const MODELS: ModelInfo[] = [
  makeModel("gpt-4", "GPT-4", "paid", "Most capable model"),
  makeModel("gpt-35", "GPT-3.5", "free", "Fast and cheap"),
  makeModel("claude", "Claude", "paid", "Anthropic model"),
  makeModel("gemini", "Gemini", "free", "Google model"),
];

const ids = (models: ModelInfo[]) => models.map((m) => m.id);

describe("filterModels", () => {
  it("returns all models when filter is 'all' and no search", () => {
    expect(ids(filterModels(MODELS, "all", ""))).toEqual([
      "gpt-4",
      "gpt-35",
      "claude",
      "gemini",
    ]);
  });

  it("filters to free tier only", () => {
    expect(ids(filterModels(MODELS, "free", ""))).toEqual(["gpt-35", "gemini"]);
  });

  it("filters to paid tier only", () => {
    expect(ids(filterModels(MODELS, "paid", ""))).toEqual(["gpt-4", "claude"]);
  });

  it("filters by search query against name and description", () => {
    expect(ids(filterModels(MODELS, "all", "gpt"))).toEqual(["gpt-4", "gpt-35"]);
    expect(ids(filterModels(MODELS, "all", "anthropic"))).toEqual(["claude"]);
  });

  it("combines tier filter with search", () => {
    expect(ids(filterModels(MODELS, "free", "g"))).toEqual(["gpt-35", "gemini"]);
  });

  it("ignores leading/trailing whitespace in search", () => {
    expect(ids(filterModels(MODELS, "all", "  gpt  "))).toEqual(["gpt-4", "gpt-35"]);
  });

  it("returns empty array when no models match", () => {
    expect(filterModels(MODELS, "all", "nonexistent-model")).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(filterModels([], "all", "")).toEqual([]);
  });
});

describe("cycleTierFilter", () => {
  it("cycles all -> free -> paid -> all", () => {
    expect(cycleTierFilter("all")).toBe("free");
    expect(cycleTierFilter("free")).toBe("paid");
    expect(cycleTierFilter("paid")).toBe("all");
  });

  it("matches TIER_FILTERS order", () => {
    expect(TIER_FILTERS).toEqual(["all", "free", "paid"]);
  });
});

describe("getStaticModelsForProvider", () => {
  it("returns gemini model info for gemini provider", () => {
    const models = getStaticModelsForProvider("gemini");
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.id.startsWith("gemini"))).toBe(true);
  });

  it("returns GLM models for zai providers", () => {
    const zai = getStaticModelsForProvider("zai");
    const zaiCoding = getStaticModelsForProvider("zai-coding");
    expect(zai.length).toBeGreaterThan(0);
    expect(zai).toEqual(zaiCoding);
  });

  it("returns empty array for openrouter", () => {
    expect(getStaticModelsForProvider("openrouter")).toEqual([]);
  });
});

describe("buildModels", () => {
  it("maps OpenRouter models for openrouter provider", () => {
    const openRouterModels: OpenRouterModel[] = [
      {
        id: "or/free-model",
        name: "Free Model",
        description: "A free model",
        contextLength: 8000,
        pricing: { prompt: "0", completion: "0" },
        isFree: true,
      },
      {
        id: "or/paid-model",
        name: "Paid Model",
        description: "A paid model",
        contextLength: 16000,
        pricing: { prompt: "1", completion: "1" },
        isFree: false,
      },
    ];
    const result = buildModels("openrouter", openRouterModels);
    expect(result.map((m) => m.id)).toEqual(["or/free-model", "or/paid-model"]);
    expect(result.map((m) => m.tier)).toEqual(["free", "paid"]);
  });

  it("returns gemini static models for gemini", () => {
    const result = buildModels("gemini", []);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((m) => typeof m.description === "string")).toBe(true);
  });

  it("returns GLM static models for zai", () => {
    const result = buildModels("zai", []);
    expect(result.length).toBeGreaterThan(0);
  });
});
