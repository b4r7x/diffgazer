/** @vitest-environment jsdom */

import { type NetworkMode, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { ServerState } from "../../schemas/presentation/diagnostics.js";
import { createTestQueryWrapper } from "../../testing/query-wrapper.js";
import type { BoundApi } from "../bound.js";
import { createApi } from "../bound.js";
import { ApiProvider } from "./context.js";
import { useServerStatus } from "./server.js";

describe("useServerStatus", () => {
  let request: Mock<BoundApi["request"]>;
  let api: Partial<BoundApi>;

  beforeEach(() => {
    request = vi.fn<BoundApi["request"]>();
    api = { request };
  });

  it("reports 'error' when the first health poll fails with no cached data", async () => {
    request.mockRejectedValue(new Error("ECONNREFUSED"));
    const { Wrapper } = createTestQueryWrapper({ api });

    const { result } = renderHook(() => useServerStatus(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state).toEqual({ status: "error", message: "ECONNREFUSED" });
    expect(result.current.latestState).toEqual({ status: "error", message: "ECONNREFUSED" });
  });

  it("keeps the gate connected across a failed retry and reports immediate recovery", async () => {
    request.mockResolvedValueOnce(new Response());
    const latestStates: ServerState[] = [];
    const { Wrapper } = createTestQueryWrapper({ api });

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

    // A subsequent retry fails, but the cached health success must keep the
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
    request.mockResolvedValueOnce(new Response());
    await act(async () => {
      await result.current.retry();
    });

    await waitFor(() => expect(result.current.latestState).toEqual({ status: "connected" }));
    expect(latestStates.find((state) => state.status !== "checking")).toEqual({
      status: "connected",
    });
    expect(result.current.state.status).toBe("connected");
  });

  it("reports checking when the first health poll is paused offline", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, networkMode: "offline" as NetworkMode },
      },
    });
    const boundApi = createApi({ baseUrl: "http://localhost" });
    const Wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(ApiProvider, { value: boundApi }, children),
      );

    const { result } = renderHook(() => useServerStatus(), { wrapper: Wrapper });

    expect(result.current.state.status).toBe("checking");
    expect(result.current.latestState.status).toBe("checking");
  });
});
