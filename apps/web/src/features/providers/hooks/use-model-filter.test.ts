import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { useModelFilter } from "./use-model-filter";

function makeModel(
  id: string,
  name: string,
  tier: "free" | "paid",
  description = "",
): ModelInfo {
  return { id, name, tier, description };
}

const MODELS: ModelInfo[] = [
  makeModel("gpt-4", "GPT-4", "paid", "Most capable model"),
  makeModel("gpt-35", "GPT-3.5", "free", "Fast and cheap"),
  makeModel("claude", "Claude", "paid", "Anthropic model"),
  makeModel("gemini", "Gemini", "free", "Google model"),
];

function modelIds(models: ModelInfo[]) {
  return models.map((model) => model.id);
}

describe("useModelFilter", () => {
  it("returns ordered models matching search text and tier filters", () => {
    const { result } = renderHook(() => useModelFilter(MODELS));

    expect(modelIds(result.current.filteredModels)).toEqual(["gpt-4", "gpt-35", "claude", "gemini"]);

    act(() => result.current.setSearchQuery("gpt"));
    expect(result.current.filteredModels.map((m) => m.name)).toEqual(["GPT-4", "GPT-3.5"]);

    act(() => result.current.setSearchQuery("anthropic"));
    expect(modelIds(result.current.filteredModels)).toEqual(["claude"]);

    act(() => {
      result.current.setSearchQuery("g");
      result.current.setTierFilter("free");
    });
    expect(modelIds(result.current.filteredModels)).toEqual(["gpt-35", "gemini"]);
  });

  it("cycles tier filters and resets to all models", () => {
    const { result } = renderHook(() => useModelFilter(MODELS));

    act(() => result.current.cycleTierFilter());
    expect(result.current.tierFilter).toBe("free");
    expect(modelIds(result.current.filteredModels)).toEqual(["gpt-35", "gemini"]);

    act(() => result.current.cycleTierFilter());
    expect(result.current.tierFilter).toBe("paid");
    expect(modelIds(result.current.filteredModels)).toEqual(["gpt-4", "claude"]);

    act(() => {
      result.current.setSearchQuery("gemini");
      result.current.resetFilters();
    });

    expect(result.current.searchQuery).toBe("");
    expect(result.current.tierFilter).toBe("all");
    expect(modelIds(result.current.filteredModels)).toEqual(["gpt-4", "gpt-35", "claude", "gemini"]);
  });

  it("returns no models for an empty list", () => {
    const { result } = renderHook(() => useModelFilter([]));

    expect(result.current.filteredModels).toEqual([]);
  });
});
