/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTimer } from "./use-timer.js";

describe("useTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial elapsedMs when not running", () => {
    const { result } = renderHook(() => useTimer({ elapsedMs: 1234, running: false }));
    expect(result.current.elapsed).toBe(1234);
  });

  it("advances elapsed while running with a startTime", () => {
    const startTime = new Date(0);
    vi.setSystemTime(new Date(0));
    const { result } = renderHook(() =>
      useTimer({ startTime, elapsedMs: 0, running: true }),
    );

    expect(result.current.elapsed).toBe(0);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.elapsed).toBe(500);
  });

  it("adds elapsedMs offset to live elapsed time", () => {
    const startTime = new Date(0);
    vi.setSystemTime(new Date(0));
    const { result } = renderHook(() =>
      useTimer({ startTime, elapsedMs: 1000, running: true }),
    );

    expect(result.current.elapsed).toBe(1000);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.elapsed).toBe(1300);
  });

  it("falls back to elapsedMs when running flips off", () => {
    const startTime = new Date(0);
    vi.setSystemTime(new Date(0));
    const { result, rerender } = renderHook(
      ({ running }) => useTimer({ startTime, elapsedMs: 200, running }),
      { initialProps: { running: true } },
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.elapsed).toBe(700);

    rerender({ running: false });
    expect(result.current.elapsed).toBe(200);
  });

  it("does nothing while running is false (no interval scheduled)", () => {
    const startTime = new Date(0);
    vi.setSystemTime(new Date(0));
    const { result } = renderHook(() =>
      useTimer({ startTime, elapsedMs: 50, running: false }),
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.elapsed).toBe(50);
  });
});
