import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsConfig } from "@diffgazer/schemas/config";

const {
  mockRefresh,
  mockSaveSettings,
  mockSaveConfig,
  mockGetSettings,
} = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockSaveSettings: vi.fn(),
  mockSaveConfig: vi.fn(),
  mockGetSettings: vi.fn(),
}));

vi.mock("@/app/providers/config-provider", () => ({
  useConfigActions: () => ({
    refresh: mockRefresh,
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    getSettings: mockGetSettings,
    saveSettings: mockSaveSettings,
    saveConfig: mockSaveConfig,
  },
}));

vi.mock("@/lib/config-guards/config-guard-cache", () => ({
  setConfiguredGuardCache: vi.fn(),
}));

import { useOnboarding } from "./use-onboarding";
import { invalidateSettingsCache, useSettings } from "@/hooks/use-settings";

const SETTINGS_FIXTURE: SettingsConfig = {
  theme: "terminal",
  defaultLenses: [],
  defaultProfile: null,
  severityThreshold: "low",
  secretsStorage: null,
  agentExecution: "parallel",
};

describe("onboarding/settings synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateSettingsCache();
    mockGetSettings.mockResolvedValue(SETTINGS_FIXTURE);
    mockRefresh.mockResolvedValue(undefined);
    mockSaveSettings.mockResolvedValue(undefined);
    mockSaveConfig.mockResolvedValue(undefined);
  });

  it("should refresh settings subscribers after onboarding completion", async () => {
    const updatedSettings: SettingsConfig = {
      ...SETTINGS_FIXTURE,
      secretsStorage: "file",
      agentExecution: "sequential",
    };

    mockGetSettings
      .mockResolvedValueOnce(SETTINGS_FIXTURE)
      .mockResolvedValueOnce(updatedSettings)
      .mockResolvedValue(updatedSettings);

    const settingsHook = renderHook(() => useSettings());

    await waitFor(() => {
      expect(settingsHook.result.current.settings?.secretsStorage ?? null).toBe(null);
    });

    const onboardingHook = renderHook(() => useOnboarding());

    await act(async () => {
      await onboardingHook.result.current.complete();
    });

    await waitFor(() => {
      expect(settingsHook.result.current.settings?.secretsStorage).toBe("file");
      expect(settingsHook.result.current.settings?.agentExecution).toBe("sequential");
    });

    expect(mockGetSettings.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
