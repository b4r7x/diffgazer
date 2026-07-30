// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LEGAL_PAGES } from "@/features/legal/lib/pages";
import { usePendingLegalRoute } from "./use-pending-legal-route";

const routerState = vi.hoisted(() => ({
  isLoading: false,
  pathname: "/",
}));

vi.mock("@tanstack/react-router", () => ({
  notFound: vi.fn(),
  useRouterState: <Result>({
    select,
  }: {
    select: (state: { isLoading: boolean; location: { pathname: string } }) => Result;
  }) =>
    select({
      isLoading: routerState.isLoading,
      location: { pathname: routerState.pathname },
    }),
}));

beforeEach(() => {
  routerState.isLoading = false;
  routerState.pathname = "/";
});

describe("usePendingLegalRoute", () => {
  it.each(LEGAL_PAGES)("reports $path during an active route load", ({ path }) => {
    routerState.isLoading = true;
    routerState.pathname = path;

    expect(renderHook(() => usePendingLegalRoute()).result.current).toBe(path);
  });

  it("ignores settled and non-legal routes", () => {
    routerState.pathname = LEGAL_PAGES[0].path;
    expect(renderHook(() => usePendingLegalRoute()).result.current).toBeNull();

    routerState.isLoading = true;
    routerState.pathname = "/ui/components/select";
    expect(renderHook(() => usePendingLegalRoute()).result.current).toBeNull();
  });
});
