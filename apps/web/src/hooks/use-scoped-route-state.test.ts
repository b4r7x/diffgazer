import { describe, it, expect, beforeEach } from "vitest";

// Test the external store logic directly without React.
// The store is module-level state in use-scoped-route-state.ts,
// but since the pure functions (getSnapshot, setValue, subscribe, cleanupIfNeeded)
// are not exported, we test indirectly through the module's Map behavior.

// We can still test the store's core contract by importing and using the hook
// with a mocked useLocation.

import { vi } from "vitest";

let mockPathname = "/test";

// Mock TanStack Router's useLocation
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: mockPathname }),
}));

import { renderHook, act } from "@testing-library/react";
import { useScopedRouteState } from "./use-scoped-route-state";

describe("useScopedRouteState", () => {
  it("should return default value initially", () => {
    const { result } = renderHook(() => useScopedRouteState("key1", "default"));
    expect(result.current[0]).toBe("default");
  });

  it("should update state with direct value", () => {
    const { result } = renderHook(() => useScopedRouteState("key2", 0));
    act(() => result.current[1](42));
    expect(result.current[0]).toBe(42);
  });

  it("should update state with functional updater", () => {
    const { result } = renderHook(() => useScopedRouteState("key3", 10));
    act(() => result.current[1]((prev) => prev + 5));
    expect(result.current[0]).toBe(15);
  });

  it("should maintain separate state per key", () => {
    const { result: result1 } = renderHook(() => useScopedRouteState("keyA", "a"));
    const { result: result2 } = renderHook(() => useScopedRouteState("keyB", "b"));

    act(() => result1.current[1]("updated-a"));

    expect(result1.current[0]).toBe("updated-a");
    expect(result2.current[0]).toBe("b");
  });

  it("should share state for same key", () => {
    const { result: result1 } = renderHook(() => useScopedRouteState("shared", "initial"));
    const { result: result2 } = renderHook(() => useScopedRouteState("shared", "initial"));

    act(() => result1.current[1]("changed"));

    expect(result1.current[0]).toBe("changed");
    expect(result2.current[0]).toBe("changed");
  });

  it("should scope state by route pathname", () => {
    mockPathname = "/route-a";
    const { result: resultA } = renderHook(() => useScopedRouteState("scoped", "default"));
    act(() => resultA.current[1]("route-a-value"));

    mockPathname = "/route-b";
    const { result: resultB } = renderHook(() => useScopedRouteState("scoped", "default"));

    expect(resultB.current[0]).toBe("default");
    expect(resultA.current[0]).toBe("route-a-value");
  });

  it("should evict oldest entries when exceeding MAX_ENTRIES (100)", () => {
    mockPathname = "/eviction-test";

    // Fill up 101 entries — first should be evicted
    const hooks: Array<{ result: { current: [number, (v: number | ((p: number) => number)) => void] } }> = [];
    for (let i = 0; i < 101; i++) {
      const { result } = renderHook(() => useScopedRouteState(`evict-${i}`, i));
      act(() => result.current[1](i * 10));
      hooks.push({ result });
    }

    // After 101 entries, the first entry (evict-0) should have been evicted
    // and return default value
    const { result: checkFirst } = renderHook(() => useScopedRouteState("evict-0", -1));
    expect(checkFirst.current[0]).toBe(-1);

    // Last entry should still exist
    const { result: checkLast } = renderHook(() => useScopedRouteState("evict-100", -1));
    expect(checkLast.current[0]).toBe(1000);
  });
});
