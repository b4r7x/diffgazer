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

  it("returns zero when not running", () => {
    const { result } = renderHook(() => useTimer({ running: false }));
    expect(result.current.elapsed).toBe(0);
  });

  it("advances elapsed while running with a startTime", () => {
    const startTime = new Date(0);
    vi.setSystemTime(new Date(0));
    const { result } = renderHook(() => useTimer({ startTime, running: true }));

    expect(result.current.elapsed).toBe(0);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.elapsed).toBe(500);
  });

  it("falls back to zero when running flips off", () => {
    const startTime = new Date(0);
    vi.setSystemTime(new Date(0));
    const { result, rerender } = renderHook(({ running }) => useTimer({ startTime, running }), {
      initialProps: { running: true },
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.elapsed).toBe(500);

    rerender({ running: false });
    expect(result.current.elapsed).toBe(0);
  });

  it("does nothing while running is false (no interval scheduled)", () => {
    const startTime = new Date(0);
    vi.setSystemTime(new Date(0));
    const { result } = renderHook(() => useTimer({ startTime, running: false }));

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.elapsed).toBe(0);
  });
});
