import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ToastProvider, useToast } from "./toast-context";
import type { ReactNode } from "react";

// Mock crypto.randomUUID
let uuidCounter = 0;
vi.stubGlobal("crypto", {
  randomUUID: () => `uuid-${++uuidCounter}`,
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

describe("ToastProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    uuidCounter = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should start with no toasts", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    expect(result.current.toasts).toHaveLength(0);
  });

  it("should add a toast", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => result.current.showToast({ variant: "info", title: "Hello" }));
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]?.title).toBe("Hello");
  });

  it("should limit to MAX_TOASTS (5)", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      for (let i = 0; i < 7; i++) {
        result.current.showToast({ variant: "info", title: `Toast ${i}` });
      }
    });
    expect(result.current.toasts).toHaveLength(5);
    // Should keep the most recent 5
    expect(result.current.toasts[0]?.title).toBe("Toast 2");
    expect(result.current.toasts[4]?.title).toBe("Toast 6");
  });

  it("should auto-dismiss non-error toasts after timeout", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => result.current.showToast({ variant: "info", title: "Auto" }));
    expect(result.current.toasts).toHaveLength(1);

    act(() => vi.advanceTimersByTime(5000));
    // After timeout, toast should be in dismissing state
    expect(result.current.dismissingIds.has("uuid-1")).toBe(true);
  });

  it("should NOT auto-dismiss error toasts", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => result.current.showToast({ variant: "error", title: "Error" }));

    act(() => vi.advanceTimersByTime(10000));
    expect(result.current.dismissingIds.size).toBe(0);
    expect(result.current.toasts).toHaveLength(1);
  });

  it("should remove toast manually", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => result.current.showToast({ variant: "info", title: "Remove me" }));
    expect(result.current.toasts).toHaveLength(1);

    act(() => result.current.removeToast("uuid-1"));
    expect(result.current.toasts).toHaveLength(0);
  });

  it("should dismiss toast (add to dismissing set)", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => result.current.showToast({ variant: "info", title: "Dismiss" }));
    act(() => result.current.dismissToast("uuid-1"));
    expect(result.current.dismissingIds.has("uuid-1")).toBe(true);
  });

  it("should respect custom duration", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => result.current.showToast({ variant: "info", title: "Custom", duration: 1000 }));

    act(() => vi.advanceTimersByTime(999));
    expect(result.current.dismissingIds.size).toBe(0);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.dismissingIds.has("uuid-1")).toBe(true);
  });

  it("should throw when useToast is used outside provider", () => {
    expect(() => {
      renderHook(() => useToast());
    }).toThrow();
  });
});
