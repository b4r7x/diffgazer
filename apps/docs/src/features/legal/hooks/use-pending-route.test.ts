import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLegalPageEntry, LEGAL_PAGES } from "@/features/legal/lib/pages";
import { useIsLegalRoutePending } from "./use-pending-route";

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

describe("useIsLegalRoutePending", () => {
  it.each(LEGAL_PAGES)("reports $path during an active route load", ({ path }) => {
    routerState.isLoading = true;
    routerState.pathname = path;

    expect(renderHook(() => useIsLegalRoutePending()).result.current).toBe(true);
  });

  it("ignores settled and non-legal routes", () => {
    routerState.pathname = getLegalPageEntry("privacy").path;
    expect(renderHook(() => useIsLegalRoutePending()).result.current).toBe(false);

    routerState.isLoading = true;
    routerState.pathname = "/ui/components/select";
    expect(renderHook(() => useIsLegalRoutePending()).result.current).toBe(false);
  });
});
