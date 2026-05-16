import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockLocation = vi.hoisted(() => ({ pathname: "/test" }));

// Boundary mock: Router is the routing library; tests provide a stub Router context so navigation assertions can be made without a real route tree.
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: mockLocation.pathname }),
}));

import { clearScopedRouteState, useScopedRouteState } from "./use-scoped-route-state";

const touchedEntries = new Set<string>();

function rememberEntry(scope: string, key: string) {
  touchedEntries.add(`${scope}\0${key}`);
}

function clearTouchedEntries() {
  touchedEntries.forEach((entry) => {
    const [scope, key] = entry.split("\0");
    if (scope && key) clearScopedRouteState(scope, key);
  });
  touchedEntries.clear();
}

function setRoute(pathname: string) {
  mockLocation.pathname = pathname;
}

function renderScopedState<T>(key: string, defaultValue: T) {
  rememberEntry(mockLocation.pathname, key);
  return renderHook(() => useScopedRouteState(key, defaultValue));
}

describe("useScopedRouteState", () => {
  beforeEach(() => {
    clearTouchedEntries();
    setRoute("/test");
  });

  afterEach(() => {
    act(() => clearTouchedEntries());
  });

  it("persists updates for consumers on the same route and key", () => {
    const first = renderScopedState("shared", 10);
    const second = renderScopedState("shared", 10);

    expect(first.result.current[0]).toBe(10);
    expect(second.result.current[0]).toBe(10);

    act(() => first.result.current[1](42));

    expect(first.result.current[0]).toBe(42);
    expect(second.result.current[0]).toBe(42);

    act(() => second.result.current[1]((prev) => prev + 8));

    expect(first.result.current[0]).toBe(50);
    expect(second.result.current[0]).toBe(50);
  });

  it("keeps separate values for different keys on the same route", () => {
    const first = renderScopedState("first", "default-a");
    const second = renderScopedState("second", "default-b");

    act(() => first.result.current[1]("saved-a"));

    expect(first.result.current[0]).toBe("saved-a");
    expect(second.result.current[0]).toBe("default-b");
  });

  it("scopes persisted values by pathname", () => {
    setRoute("/route-a");
    const routeA = renderScopedState("selection", "default");
    act(() => routeA.result.current[1]("route-a-value"));

    setRoute("/route-b");
    const routeB = renderScopedState("selection", "default");
    act(() => routeB.result.current[1]("route-b-value"));

    setRoute("/route-a");
    const routeAAgain = renderScopedState("selection", "default");

    expect(routeAAgain.result.current[0]).toBe("route-a-value");
    expect(routeB.result.current[0]).toBe("route-b-value");
  });
});
