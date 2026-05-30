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

const { useOpenRouterModelsMapped } = await import("./use-openrouter-models-mapped");

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
});
