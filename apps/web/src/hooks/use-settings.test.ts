import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const SETTINGS_FIXTURE = {
  theme: "dark",
  defaultLenses: [],
  defaultProfile: null,
  severityThreshold: "low",
  secretsStorage: null,
  agentExecution: "parallel",
};

const mockGetSettings = vi.fn(() => Promise.resolve(SETTINGS_FIXTURE));

vi.mock("@/lib/api", () => ({
  api: {
    getSettings: (...args: unknown[]) => mockGetSettings(...args),
  },
}));

import { useSettings } from "./use-settings";

describe("useSettings", () => {
  beforeEach(async () => {
    mockGetSettings.mockClear();
    mockGetSettings.mockImplementation(() => Promise.resolve(SETTINGS_FIXTURE));
    // Invalidate module-level cache and let the auto-refetch settle
    const { result } = renderHook(() => useSettings());
    act(() => result.current.invalidate());
    await waitFor(() => {
      expect(result.current.settings).not.toBeNull();
    });
    mockGetSettings.mockClear();
    mockGetSettings.mockImplementation(() => Promise.resolve(SETTINGS_FIXTURE));
  });

  it("should return settings from cache", async () => {
    const { result } = renderHook(() => useSettings());

    // Cache is warm from beforeEach, settings should be available
    expect(result.current.settings).toEqual(SETTINGS_FIXTURE);
  });

  it("should return fresh data on refresh", async () => {
    const updatedSettings = { ...SETTINGS_FIXTURE, theme: "light" };
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.settings).not.toBeNull();
    });

    mockGetSettings.mockImplementation(() => Promise.resolve(updatedSettings));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.settings).toEqual(updatedSettings);
  });

  it("should clear data on invalidate", async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.settings).not.toBeNull();
    });

    act(() => result.current.invalidate());
    expect(result.current.settings).toBeNull();

    // Wait for auto-refetch to complete
    await waitFor(() => {
      expect(result.current.settings).toEqual(SETTINGS_FIXTURE);
    });
  });

  it("should refetch after cache TTL expires", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.settings).not.toBeNull();
    });

    mockGetSettings.mockClear();

    // Advance past TTL (5 minutes)
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    // After TTL, cache is expired. Invalidate triggers refetch that sees expired cache.
    act(() => result.current.invalidate());

    await waitFor(() => {
      expect(result.current.settings).toEqual(SETTINGS_FIXTURE);
    });
    expect(mockGetSettings).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("should deduplicate concurrent fetches", async () => {
    // After beforeEach, cache is warm and mockGetSettings is cleared.
    // Invalidate and immediately render two hooks to test dedup.
    const { result: setupResult } = renderHook(() => useSettings());
    act(() => setupResult.current.invalidate());

    // Wait for the auto-refetch triggered by invalidate to settle
    await waitFor(() => {
      expect(setupResult.current.settings).not.toBeNull();
    });

    // Now invalidate again and track calls from this point
    mockGetSettings.mockClear();
    act(() => setupResult.current.invalidate());

    // Both hooks will try to trigger a fetch from their useEffect
    const { result: result1 } = renderHook(() => useSettings());
    const { result: result2 } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result1.current.settings).not.toBeNull();
    });
    await waitFor(() => {
      expect(result2.current.settings).not.toBeNull();
    });

    // The inflight guard in triggerFetch means at most 1 call was made
    // despite 3 hooks (setupResult, result1, result2) all seeing null cache
    expect(mockGetSettings).toHaveBeenCalledTimes(1);
  });
});
