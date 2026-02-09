import { describe, it, expect } from "vitest";
import type { ModelInfo } from "@diffgazer/schemas/config";

// We can't import filterModels directly since it's not exported,
// but we can test it through the hook. Instead, let's replicate the
// pure function logic for direct testing.
// The actual filterModels is module-private, so we test via the hook.
import { renderHook, act } from "@testing-library/react";
import { useModelFilter } from "./use-model-filter";

function makeModel(name: string, tier: "free" | "paid", description = ""): ModelInfo {
  return { name, tier, description } as ModelInfo;
}

const MODELS: ModelInfo[] = [
  makeModel("GPT-4", "paid", "Most capable model"),
  makeModel("GPT-3.5", "free", "Fast and cheap"),
  makeModel("Claude", "paid", "Anthropic model"),
  makeModel("Gemini", "free", "Google model"),
];

describe("useModelFilter", () => {
  it("should return all models with default filters", () => {
    const { result } = renderHook(() => useModelFilter(MODELS));
    expect(result.current.filteredModels).toHaveLength(4);
  });

  it("should filter by search text matching name", () => {
    const { result } = renderHook(() => useModelFilter(MODELS));
    act(() => result.current.setSearchQuery("gpt"));
    expect(result.current.filteredModels).toHaveLength(2);
  });

  it("should filter by search text matching description", () => {
    const { result } = renderHook(() => useModelFilter(MODELS));
    act(() => result.current.setSearchQuery("anthropic"));
    expect(result.current.filteredModels).toHaveLength(1);
    expect(result.current.filteredModels[0]?.name).toBe("Claude");
  });

  it("should filter by free tier", () => {
    const { result } = renderHook(() => useModelFilter(MODELS));
    act(() => result.current.setTierFilter("free"));
    expect(result.current.filteredModels).toHaveLength(2);
    expect(result.current.filteredModels.every((m) => m.tier === "free")).toBe(true);
  });

  it("should filter by paid tier", () => {
    const { result } = renderHook(() => useModelFilter(MODELS));
    act(() => result.current.setTierFilter("paid"));
    expect(result.current.filteredModels).toHaveLength(2);
    expect(result.current.filteredModels.every((m) => m.tier === "paid")).toBe(true);
  });

  it("should combine search and tier filters", () => {
    const { result } = renderHook(() => useModelFilter(MODELS));
    act(() => {
      result.current.setSearchQuery("g");
      result.current.setTierFilter("free");
    });
    // "GPT-3.5" (free, has g) and "Gemini" (free, has g)
    expect(result.current.filteredModels).toHaveLength(2);
  });

  it("should cycle tier filter through all -> free -> paid -> all", () => {
    const { result } = renderHook(() => useModelFilter(MODELS));
    expect(result.current.tierFilter).toBe("all");
    act(() => result.current.cycleTierFilter());
    expect(result.current.tierFilter).toBe("free");
    act(() => result.current.cycleTierFilter());
    expect(result.current.tierFilter).toBe("paid");
    act(() => result.current.cycleTierFilter());
    expect(result.current.tierFilter).toBe("all");
  });

  it("should reset filters", () => {
    const { result } = renderHook(() => useModelFilter(MODELS));
    act(() => {
      result.current.setSearchQuery("test");
      result.current.setTierFilter("free");
    });
    act(() => result.current.resetFilters());
    expect(result.current.searchQuery).toBe("");
    expect(result.current.tierFilter).toBe("all");
    expect(result.current.filteredModels).toHaveLength(4);
  });

  it("should handle empty model list", () => {
    const { result } = renderHook(() => useModelFilter([]));
    expect(result.current.filteredModels).toHaveLength(0);
  });
});
