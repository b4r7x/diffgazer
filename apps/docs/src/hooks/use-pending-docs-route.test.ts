// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePendingDocsRoute } from "./use-pending-docs-route";

const routerState = vi.hoisted(() => ({
  status: "pending" as "idle" | "pending",
  isLoading: false,
  pathname: "/ui/components/button",
}));

vi.mock("@tanstack/react-router", () => ({
  useRouterState: <Result>({
    select,
  }: {
    select: (state: {
      status: "idle" | "pending";
      isLoading: boolean;
      location: { pathname: string };
    }) => Result;
  }) =>
    select({
      status: routerState.status,
      isLoading: routerState.isLoading,
      location: { pathname: routerState.pathname },
    }),
}));

describe("usePendingDocsRoute", () => {
  beforeEach(() => {
    routerState.status = "pending";
    routerState.isLoading = false;
    routerState.pathname = "/ui/components/button";
  });

  it("ignores a completed initial server load whose router status has not settled", () => {
    const { result } = renderHook(() => usePendingDocsRoute());

    expect(result.current).toBeNull();
  });

  it("reports a docs path during an active route load", () => {
    routerState.isLoading = true;

    const { result } = renderHook(() => usePendingDocsRoute());

    expect(result.current).toBe("/ui/components/button");
  });

  it("ignores active loads outside the docs libraries", () => {
    routerState.isLoading = true;
    routerState.pathname = "/privacy";

    const { result } = renderHook(() => usePendingDocsRoute());

    expect(result.current).toBeNull();
  });
});
