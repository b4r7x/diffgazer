/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseOpenRouterModels = vi.fn();
const mockUseProviderModels = vi.fn();

// Boundary mock: api/hooks/config wraps fetch-backed model queries; tests provide canned query states.
vi.mock("../api/hooks/config", () => ({
  useOpenRouterModels: (...args: unknown[]) => mockUseOpenRouterModels(...args),
  useProviderModels: (...args: unknown[]) => mockUseProviderModels(...args),
}));

const { useModelSource } = await import("./use-model-source.js");

const IDLE = { data: undefined, isLoading: false, error: null };

describe("useModelSource", () => {
  beforeEach(() => {
    mockUseOpenRouterModels.mockReset();
    mockUseProviderModels.mockReset();
  });

  it("serves the OpenRouter source and exposes its raw state for openrouter", () => {
    mockUseOpenRouterModels.mockReturnValue({
      data: {
        models: [
          {
            id: "openrouter/free-model",
            name: "Free Model",
            description: "",
            isFree: true,
            supportedParameters: ["structured_outputs"],
          },
        ],
        fetchedAt: new Date().toISOString(),
        cached: false,
      },
      isLoading: false,
      error: null,
    });
    mockUseProviderModels.mockReturnValue(IDLE);

    const { result } = renderHook(() => useModelSource(true, "openrouter"));

    expect(result.current.isOpenRouter).toBe(true);
    expect(result.current.models.map((m) => m.id)).toEqual(["openrouter/free-model"]);
    expect(result.current.error).toBeNull();
    expect(result.current.openRouter.total).toBe(1);
  });

  it("serves the catalog source for a non-openrouter provider", () => {
    mockUseOpenRouterModels.mockReturnValue(IDLE);
    mockUseProviderModels.mockReturnValue({
      data: {
        models: [
          { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "", tier: "free" },
        ],
        fetchedAt: new Date().toISOString(),
        source: "live",
        cached: false,
      },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useModelSource(true, "gemini"));

    expect(result.current.isOpenRouter).toBe(false);
    expect(result.current.models.map((m) => m.id)).toEqual(["gemini-2.5-flash"]);
    expect(result.current.openRouter.models).toEqual([]);
  });

  it("stays empty for both branches while the picker is closed", () => {
    mockUseOpenRouterModels.mockReturnValue(IDLE);
    mockUseProviderModels.mockReturnValue(IDLE);

    const { result } = renderHook(() => useModelSource(false, "gemini"));

    expect(result.current.models).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
