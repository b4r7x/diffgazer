/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoundApi } from "../bound.js";
import { ApiProvider } from "./context.js";
import { type ServerState, useServerStatus } from "./server.js";

function makeWrapper(api: BoundApi) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ApiProvider, { value: api }, children),
    );
  return { queryClient, Wrapper };
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
    const { Wrapper } = makeWrapper(api);

    const { result } = renderHook(() => useServerStatus(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state).toEqual({ status: "error", message: "ECONNREFUSED" });
    expect(result.current.latestState).toEqual({ status: "error", message: "ECONNREFUSED" });
  });

  it("keeps the gate connected across a failed poll and reports immediate recovery", async () => {
    request.mockResolvedValueOnce(undefined);
    const latestStates: ServerState[] = [];
    const { queryClient, Wrapper } = makeWrapper(api);

    const { result } = renderHook(
      () => {
        const serverStatus = useServerStatus();
        latestStates.push(serverStatus.latestState);
        return serverStatus;
      },
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.state.status).toBe("connected"));
    expect(result.current.latestState).toEqual({ status: "connected" });

    // A subsequent poll fails, but the cached health success must keep the
    // gated tree mounted rather than flipping the whole app to "error".
    request.mockRejectedValue(new Error("transient drop"));
    await act(async () => {
      await expect(result.current.retry()).rejects.toThrow("transient drop");
    });

    expect(result.current.state.status).toBe("connected");
    await waitFor(() => {
      expect(result.current.latestState).toEqual({ status: "error", message: "transient drop" });
    });

    latestStates.length = 0;
    request.mockResolvedValueOnce(undefined);
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["server", "health"] });
    });

    await waitFor(() => expect(result.current.latestState).toEqual({ status: "connected" }));
    expect(latestStates.find((state) => state.status !== "checking")).toEqual({
      status: "connected",
    });
    expect(result.current.state.status).toBe("connected");
  });
});
