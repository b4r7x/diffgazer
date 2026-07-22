/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
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
  fetchedAt: "2026-06-02T00:00:00.000Z",
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
    expect(result.current.source).toBe("live");
    expect(result.current.fetchedAt).toBe("2026-06-02T00:00:00.000Z");
  });

  it.each(["cache", "snapshot"] as const)("preserves %s catalog provenance", async (source) => {
    getProviderModels.mockResolvedValue({ ...GEMINI_CATALOG, source, cached: source === "cache" });
    const { Wrapper } = createTestQueryWrapper({ api });
    const { result } = renderHook(() => useProviderModelsMapped(true, "gemini"), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.source).toBe(source);
    expect(result.current.fetchedAt).toBe(GEMINI_CATALOG.fetchedAt);
  });

  it("refetches the catalog on retry", async () => {
    const { Wrapper } = createTestQueryWrapper({ api });
    const { result } = renderHook(() => useProviderModelsMapped(true, "gemini"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(getProviderModels).toHaveBeenCalledOnce());

    act(() => result.current.retry());

    await waitFor(() => expect(getProviderModels).toHaveBeenCalledTimes(2));
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
    await act(async () => {
      await queryClient.refetchQueries();
    });

    await waitFor(() => {
      expect(result.current.models.map((m) => m.id)).toEqual([
        "gemini-2.5-flash",
        "gemini-3-pro-preview",
      ]);
      expect(result.current.error).toBeNull();
      expect(result.current.source).toBe("live");
      expect(result.current.fetchedAt).toBe(GEMINI_CATALOG.fetchedAt);
    });
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
