/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderModelsResponse } from "../../schemas/config/index.js";
import type { BoundApi } from "../bound.js";
import { useProviderModels } from "./config.js";
import { ApiProvider } from "./context.js";

function makeResponse(id: string): ProviderModelsResponse {
  return {
    models: [{ id, name: id, description: id, tier: "free" }],
    fetchedAt: new Date().toISOString(),
    source: "live",
    cached: false,
  };
}

function makeWrapper(api: BoundApi) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ApiProvider, { value: api }, children),
    );
}

describe("useProviderModels", () => {
  let getProviderModels: ReturnType<typeof vi.fn>;
  let api: BoundApi;

  beforeEach(() => {
    getProviderModels = vi.fn(async (id: string) => makeResponse(id));
    api = { getProviderModels } as unknown as BoundApi;
  });

  it("fetches models for the requested provider", async () => {
    const { result } = renderHook(() => useProviderModels("gemini"), { wrapper: makeWrapper(api) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.models[0]?.id).toBe("gemini");
  });

  it("does not fetch when disabled", () => {
    renderHook(() => useProviderModels("gemini", { enabled: false }), {
      wrapper: makeWrapper(api),
    });
    expect(getProviderModels).not.toHaveBeenCalled();
  });

  it("refetches with the new provider id across rerender", async () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: "gemini" | "groq" }) => useProviderModels(id),
      { wrapper: makeWrapper(api), initialProps: { id: "gemini" } },
    );
    await waitFor(() => expect(result.current.data?.models[0]?.id).toBe("gemini"));
    rerender({ id: "groq" });
    await waitFor(() => expect(result.current.data?.models[0]?.id).toBe("groq"));
  });
});
