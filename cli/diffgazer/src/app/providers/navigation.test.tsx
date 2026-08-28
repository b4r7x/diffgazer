/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { useNavigation } from "../../hooks/use-navigation";
import { NavigationProvider } from "./navigation";

function createWrapper(initialRoute?: Parameters<typeof NavigationProvider>[0]["initialRoute"]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <NavigationProvider initialRoute={initialRoute}>{children}</NavigationProvider>;
  };
}

describe("NavigationProvider back capability", () => {
  it("does not advertise a route-back action during onboarding", () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: createWrapper({ screen: "onboarding" }),
    });

    expect(result.current.canGoBack).toBe(false);
  });
});

describe("NavigationProvider stack", () => {
  it("returns to History after opening and closing a saved review", () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: createWrapper({ screen: "history" }),
    });

    act(() => {
      result.current.navigate({ screen: "review", reviewId: "history-review-1" });
    });
    expect(result.current.route).toEqual({ screen: "review", reviewId: "history-review-1" });

    act(() => {
      result.current.goBack();
    });
    expect(result.current.route).toEqual({ screen: "history" });
  });

  it("returns to the main menu from History", () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: createWrapper({ screen: "home" }),
    });

    act(() => {
      result.current.navigate({ screen: "history" });
    });

    act(() => {
      result.current.goBack();
    });
    expect(result.current.route).toEqual({ screen: "home" });
  });

  it("restores the prior route through bounded LIFO pops", () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: createWrapper({ screen: "home" }),
    });

    act(() => {
      result.current.navigate({ screen: "settings" });
    });
    expect(result.current.route).toEqual({ screen: "settings" });

    act(() => {
      result.current.navigate({ screen: "help" });
    });
    expect(result.current.route).toEqual({ screen: "help" });

    act(() => {
      result.current.goBack();
    });
    expect(result.current.route).toEqual({ screen: "settings" });

    act(() => {
      result.current.goBack();
    });
    expect(result.current.route).toEqual({ screen: "home" });
  });
});
