/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseOpenRouterModels = vi.fn();

// Boundary mock: useOpenRouterModels is the OpenRouter HTTP-data fetch hook; we provide canned hook return values to drive UI behavior assertions.
vi.mock("../api/hooks/config", () => ({
  useOpenRouterModels: (...args: unknown[]) => mockUseOpenRouterModels(...args),
}));

const { useOpenRouterModelsMapped, getCompatibilityLabel } = await import(
  "./use-openrouter-models-mapped.js"
);

describe("getCompatibilityLabel", () => {
  it("reports no models available when total is zero", () => {
    expect(getCompatibilityLabel({ total: 0, compatible: 0, hasParams: false })).toBe(
      "No models available.",
    );
  });

  it("reports filtered compatibility ratio when compatible < total", () => {
    expect(getCompatibilityLabel({ total: 100, compatible: 42, hasParams: true })).toBe(
      "Showing 42/100 models that support structured outputs.",
    );
  });

  it("reports full compatibility when all models match", () => {
    expect(getCompatibilityLabel({ total: 5, compatible: 5, hasParams: true })).toBe(
      "Showing models that support structured outputs.",
    );
  });

  it("reports unknown compatibility when no model exposes params", () => {
    expect(getCompatibilityLabel({ total: 5, compatible: 5, hasParams: false })).toBe(
      "Compatibility unknown; showing all models.",
    );
  });
});

describe("useOpenRouterModelsMapped", () => {
  beforeEach(() => {
    mockUseOpenRouterModels.mockReset();
  });

  it("filters to compatible models and maps them", () => {
    mockUseOpenRouterModels.mockReturnValue({
      data: {
        models: [
          {
            id: "openrouter/free-model",
            name: "Free Model",
            description: "supports structured outputs",
            isFree: true,
            supportedParameters: ["structured_outputs"],
          },
          {
            id: "openrouter/other-model",
            name: "Other Model",
            description: "not compatible",
            isFree: false,
            supportedParameters: ["temperature"],
          },
        ],
        fetchedAt: new Date().toISOString(),
        cached: false,
      },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useOpenRouterModelsMapped(true, "openrouter"));

    expect(result.current.loading).toBe(false);
    expect(result.current.total).toBe(2);
    expect(result.current.compatible).toBe(1);
    expect(result.current.models).toEqual([
      {
        id: "openrouter/free-model",
        name: "Free Model",
        description: "supports structured outputs",
        tier: "free",
      },
    ]);
  });

  it("returns error state when query has error", () => {
    mockUseOpenRouterModels.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Network error"),
    });

    const { result } = renderHook(() => useOpenRouterModelsMapped(true, "openrouter"));

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("Network error");
    expect(result.current.models).toEqual([]);
  });

  it("keeps the last-good models when a background refetch fails", () => {
    mockUseOpenRouterModels.mockReturnValue({
      data: {
        models: [
          {
            id: "openrouter/known",
            name: "Known",
            description: "supports structured outputs",
            isFree: true,
            supportedParameters: ["structured_outputs"],
          },
        ],
        fetchedAt: new Date().toISOString(),
        cached: false,
      },
      isLoading: false,
      error: new Error("Network error"),
    });

    const { result } = renderHook(() => useOpenRouterModelsMapped(true, "openrouter"));

    expect(result.current.error).toBeNull();
    expect(result.current.compatible).toBe(1);
    expect(result.current.models.map((model) => model.id)).toEqual(["openrouter/known"]);
  });

  it("returns empty state when provider is not openrouter", () => {
    mockUseOpenRouterModels.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useOpenRouterModelsMapped(true, "gemini"));

    expect(result.current.loading).toBe(false);
    expect(result.current.models).toEqual([]);
    expect(mockUseOpenRouterModels).toHaveBeenCalledWith({ enabled: false });
  });

  it("returns empty state when dialog is closed", () => {
    mockUseOpenRouterModels.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useOpenRouterModelsMapped(false, "openrouter"));

    expect(result.current.loading).toBe(false);
    expect(result.current.models).toEqual([]);
    expect(mockUseOpenRouterModels).toHaveBeenCalledWith({ enabled: false });
  });

  it("falls back to all models when no model has supported parameters", () => {
    mockUseOpenRouterModels.mockReturnValue({
      data: {
        models: [
          {
            id: "or/unknown",
            name: "Unknown",
            description: "no params",
            isFree: false,
          },
        ],
        fetchedAt: new Date().toISOString(),
        cached: false,
      },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useOpenRouterModelsMapped(true, "openrouter"));

    expect(result.current.hasParams).toBe(false);
    expect(result.current.compatible).toBe(1);
    expect(result.current.models).toHaveLength(1);
  });

  it("returns zero compatible models when every model exposes parameters but none support structured outputs", () => {
    mockUseOpenRouterModels.mockReturnValue({
      data: {
        models: [
          {
            id: "or/text-a",
            name: "Text A",
            description: "text only",
            isFree: false,
            supportedParameters: ["temperature"],
          },
          {
            id: "or/text-b",
            name: "Text B",
            description: "text only",
            isFree: true,
            supportedParameters: ["top_p"],
          },
        ],
        fetchedAt: new Date().toISOString(),
        cached: false,
      },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useOpenRouterModelsMapped(true, "openrouter"));

    expect(result.current.hasParams).toBe(true);
    expect(result.current.total).toBe(2);
    expect(result.current.compatible).toBe(0);
    expect(result.current.models).toEqual([]);
  });
});
