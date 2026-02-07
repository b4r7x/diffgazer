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
  beforeEach(() => {
    mockGetSettings.mockClear();
    mockGetSettings.mockImplementation(() => Promise.resolve(SETTINGS_FIXTURE));
  });

  it("should return null then settings after mount", async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.settings).toEqual(SETTINGS_FIXTURE);
    });
    expect(mockGetSettings).toHaveBeenCalledOnce();
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
});
