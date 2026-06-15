/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoundApi } from "../bound.js";
import { ApiProvider } from "./context.js";
import { useServerStatus } from "./server.js";

function makeWrapper(api: BoundApi) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ApiProvider, { value: api }, children),
    );
}

describe("useServerStatus", () => {
  let request: ReturnType<typeof vi.fn>;
  let api: BoundApi;

  beforeEach(() => {
    request = vi.fn();
    api = { request } as unknown as BoundApi;
  });

  it("reports 'error' when the first health poll fails with no cached data", async () => {
    request.mockRejectedValue(new Error("ECONNREFUSED"));

    const { result } = renderHook(() => useServerStatus(), { wrapper: makeWrapper(api) });

    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state).toEqual({ status: "error", message: "ECONNREFUSED" });
  });

  it("stays 'connected' when a later poll fails after a prior success", async () => {
    request.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useServerStatus(), { wrapper: makeWrapper(api) });

    await waitFor(() => expect(result.current.state.status).toBe("connected"));

    // A subsequent poll fails, but the cached health success must keep the
    // gated tree mounted rather than flipping the whole app to "error".
    request.mockRejectedValue(new Error("transient drop"));
    await act(async () => {
      await result.current.retry().catch(() => {});
    });

    expect(result.current.state.status).toBe("connected");
  });
});
