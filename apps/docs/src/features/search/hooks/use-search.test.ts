// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const doSearchMock = vi.hoisted(() => vi.fn());

// Boundary mock: TanStack Start server functions cross the client/server boundary.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({
      handler: () => doSearchMock,
    }),
  }),
}));

import { useSearch } from "./use-search";

describe("useSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    doSearchMock.mockReset();
    doSearchMock.mockResolvedValue([
      {
        id: "button",
        url: "/docs/ui/components/button",
        type: "page",
        content: "Button",
        breadcrumbs: [],
      },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function flushSearchDebounce() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
  }

  it("debounces search requests", async () => {
    const { result } = renderHook(() => useSearch());

    act(() => result.current.search("bu"));
    expect(doSearchMock).not.toHaveBeenCalled();

    await flushSearchDebounce();

    expect(doSearchMock).toHaveBeenCalledTimes(1);
    expect(doSearchMock).toHaveBeenCalledWith(expect.objectContaining({ data: "bu" }));
  });

  it("aborts stale searches when the query changes", async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    const first = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    doSearchMock.mockImplementationOnce(() => first);
    doSearchMock.mockResolvedValueOnce([
      {
        id: "callout",
        url: "/docs/ui/components/callout",
        type: "page",
        content: "Callout",
        breadcrumbs: [],
      },
    ]);

    const { result } = renderHook(() => useSearch());

    act(() => result.current.search("bu"));
    await flushSearchDebounce();

    act(() => result.current.search("call"));
    await flushSearchDebounce();

    await act(async () => {
      resolveFirst([
        {
          id: "stale",
          url: "/docs/ui/components/stale",
          type: "page",
          content: "Stale",
          breadcrumbs: [],
        },
      ]);
      await Promise.resolve();
    });

    expect(result.current.status).toBe("success");
    expect(result.current.results[0]?.title).toBe("Callout");
  });

  it("surfaces search failures", async () => {
    doSearchMock.mockRejectedValueOnce(new Error("network down"));

    const { result } = renderHook(() => useSearch());

    act(() => result.current.search("button"));
    await flushSearchDebounce();

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Search failed. Try again.");
  });
});
