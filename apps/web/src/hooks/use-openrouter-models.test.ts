import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const mockGetOpenRouterModels = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    getOpenRouterModels: (...args: unknown[]) => mockGetOpenRouterModels(...args),
  },
}));

import { useOpenRouterModels } from "./use-openrouter-models";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useOpenRouterModels", () => {
  beforeEach(() => {
    mockGetOpenRouterModels.mockReset();
  });

  it("finishes loading after models request resolves", async () => {
    const request = createDeferred<{
      models: Array<{
        id: string;
        name: string;
        description?: string;
        isFree: boolean;
        supportedParameters?: string[];
      }>;
      fetchedAt: string;
      cached: boolean;
    }>();
    mockGetOpenRouterModels.mockReturnValueOnce(request.promise);

    const { result } = renderHook(() => useOpenRouterModels(true, "openrouter"));

    expect(result.current.loading).toBe(true);
    expect(mockGetOpenRouterModels).toHaveBeenCalledTimes(1);

    await act(async () => {
      request.resolve({
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
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

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

  it("returns error state when API rejects", async () => {
    mockGetOpenRouterModels.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useOpenRouterModels(true, "openrouter"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.models).toEqual([]);
  });

  it("resets when provider is not openrouter", () => {
    const { result } = renderHook(() => useOpenRouterModels(true, "google"));

    expect(result.current.loading).toBe(false);
    expect(result.current.models).toEqual([]);
    expect(mockGetOpenRouterModels).not.toHaveBeenCalled();
  });

  it("resets when dialog is closed", () => {
    const { result } = renderHook(() => useOpenRouterModels(false, "openrouter"));

    expect(result.current.loading).toBe(false);
    expect(result.current.models).toEqual([]);
    expect(mockGetOpenRouterModels).not.toHaveBeenCalled();
  });
});
