/** @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoundApi } from "../api/bound.js";
import type { ProviderModelsResponse } from "../schemas/config/index.js";
import { createTestQueryWrapper } from "../testing/query-wrapper.js";
import { useProviderModelsMapped } from "./use-models-mapped.js";

const GEMINI_CATALOG: ProviderModelsResponse = {
  models: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "1M ctx", tier: "free" },
    { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", description: "1M ctx", tier: "paid" },
  ],
  fetchedAt: new Date().toISOString(),
  source: "live",
  cached: false,
};

describe("useProviderModelsMapped", () => {
  let getProviderModels: ReturnType<typeof vi.fn>;
  let api: BoundApi;

  beforeEach(() => {
    getProviderModels = vi.fn(async () => GEMINI_CATALOG);
    api = { getProviderModels } as unknown as BoundApi;
  });

  it("returns the catalog models once the query resolves", async () => {
    const { Wrapper } = createTestQueryWrapper({ api });
    const { result } = renderHook(() => useProviderModelsMapped(true, "gemini"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.models.map((m) => m.id)).toEqual([
      "gemini-2.5-flash",
      "gemini-3-pro-preview",
    ]);
  });

  it("keeps the last-good models when a background refetch fails", async () => {
    const { Wrapper, queryClient } = createTestQueryWrapper({ api });
    const { result } = renderHook(() => useProviderModelsMapped(true, "gemini"), {
      wrapper: Wrapper,
    });

    await waitFor(() =>
      expect(result.current.models.map((m) => m.id)).toEqual([
        "gemini-2.5-flash",
        "gemini-3-pro-preview",
      ]),
    );

    getProviderModels.mockRejectedValueOnce(new Error("catalog unavailable"));
    await queryClient.refetchQueries();

    // Wait until TanStack has the failed refetch in hand alongside the retained
    // data (error state + last-good data both present) before asserting the hook.
    await waitFor(() => {
      const query = queryClient.getQueryCache().getAll()[0];
      expect(query?.state.status).toBe("error");
      expect(query?.state.data).toBeDefined();
    });

    expect(result.current.models.map((m) => m.id)).toEqual([
      "gemini-2.5-flash",
      "gemini-3-pro-preview",
    ]);
    expect(result.current.error).toBeNull();
  });

  it("reports loading while the catalog query is in flight", () => {
    const { Wrapper } = createTestQueryWrapper({ api });
    const { result } = renderHook(() => useProviderModelsMapped(true, "gemini"), {
      wrapper: Wrapper,
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.models).toEqual([]);
  });

  it("surfaces the error message when the catalog query fails", async () => {
    getProviderModels.mockRejectedValue(new Error("catalog unavailable"));
    const { Wrapper } = createTestQueryWrapper({ api });
    const { result } = renderHook(() => useProviderModelsMapped(true, "gemini"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.error).toBe("catalog unavailable"));
    expect(result.current.models).toEqual([]);
  });

  it("stays empty without fetching for openrouter (it has its own live path)", async () => {
    const { Wrapper } = createTestQueryWrapper({ api });
    const { result } = renderHook(() => useProviderModelsMapped(true, "openrouter"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.models).toEqual([]);
    expect(getProviderModels).not.toHaveBeenCalled();
  });

  it("stays empty without fetching while the dialog is closed", async () => {
    const { Wrapper } = createTestQueryWrapper({ api });
    const { result } = renderHook(() => useProviderModelsMapped(false, "gemini"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.models).toEqual([]);
    expect(getProviderModels).not.toHaveBeenCalled();
  });
});
