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

const IDLE = { data: undefined, isLoading: false, error: null, refetch: vi.fn() };

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
    expect(result.current.source).toBeNull();
    expect(result.current.fetchedAt).toBeNull();
  });

  it("serves the catalog source for a non-openrouter provider", () => {
    mockUseOpenRouterModels.mockReturnValue(IDLE);
    mockUseProviderModels.mockReturnValue({
      data: {
        models: [
          { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "", tier: "free" },
        ],
        fetchedAt: "2026-06-02T00:00:00.000Z",
        source: "cache",
        cached: true,
      },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useModelSource(true, "gemini"));

    expect(result.current.isOpenRouter).toBe(false);
    expect(result.current.models.map((m) => m.id)).toEqual(["gemini-2.5-flash"]);
    expect(result.current.openRouter.models).toEqual([]);
    expect(result.current.source).toBe("cache");
    expect(result.current.fetchedAt).toBe("2026-06-02T00:00:00.000Z");
  });

  it("clears visible models once the picker closes", () => {
    mockUseOpenRouterModels.mockReturnValue(IDLE);
    mockUseProviderModels.mockReturnValue({
      data: {
        models: [
          { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "", tier: "free" },
        ],
        fetchedAt: "2026-06-02T00:00:00.000Z",
        source: "cache",
        cached: true,
      },
      isLoading: false,
      error: null,
    });

    const { result, rerender } = renderHook(({ open }) => useModelSource(open, "gemini"), {
      initialProps: { open: true },
    });

    expect(result.current.models.map((m) => m.id)).toEqual(["gemini-2.5-flash"]);

    rerender({ open: false });

    expect(result.current.models).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
