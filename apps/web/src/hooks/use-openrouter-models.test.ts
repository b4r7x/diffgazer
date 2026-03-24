import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const mockUseSharedOpenRouterModels = vi.fn();

vi.mock("@diffgazer/api/hooks", () => ({
  useOpenRouterModels: (...args: unknown[]) => mockUseSharedOpenRouterModels(...args),
}));

import { useOpenRouterModels } from "./use-openrouter-models";

describe("useOpenRouterModels", () => {
  beforeEach(() => {
    mockUseSharedOpenRouterModels.mockReset();
  });

  it("filters to compatible models and maps them", () => {
    mockUseSharedOpenRouterModels.mockReturnValue({
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

    const { result } = renderHook(() => useOpenRouterModels(true, "openrouter"));

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
    mockUseSharedOpenRouterModels.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Network error"),
    });

    const { result } = renderHook(() => useOpenRouterModels(true, "openrouter"));

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("Network error");
    expect(result.current.models).toEqual([]);
  });

  it("resets when provider is not openrouter", () => {
    mockUseSharedOpenRouterModels.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useOpenRouterModels(true, "google"));

    expect(result.current.loading).toBe(false);
    expect(result.current.models).toEqual([]);
    expect(mockUseSharedOpenRouterModels).toHaveBeenCalledWith({ enabled: false });
  });

  it("resets when dialog is closed", () => {
    mockUseSharedOpenRouterModels.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useOpenRouterModels(false, "openrouter"));

    expect(result.current.loading).toBe(false);
    expect(result.current.models).toEqual([]);
    expect(mockUseSharedOpenRouterModels).toHaveBeenCalledWith({ enabled: false });
  });
});
