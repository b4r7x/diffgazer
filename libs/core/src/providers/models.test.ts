import { describe, it, expect } from "vitest";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { TIER_FILTERS, cycleTierFilter, filterModels } from "./models.js";

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
