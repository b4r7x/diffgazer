import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { AVAILABLE_PROVIDERS } from "@diffgazer/schemas/config";

const {
  mockRefresh,
  mockSaveSettings,
  mockSaveConfig,
  mockSetConfiguredGuardCache,
  mockRefreshSettingsCache,
} = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockSaveSettings: vi.fn(),
  mockSaveConfig: vi.fn(),
  mockSetConfiguredGuardCache: vi.fn(),
  mockRefreshSettingsCache: vi.fn(),
}));

vi.mock("@/app/providers/config-provider", () => ({
  useConfigActions: () => ({
    refresh: mockRefresh,
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    saveSettings: mockSaveSettings,
    saveConfig: mockSaveConfig,
  },
}));

vi.mock("@/hooks/use-settings", () => ({
  refreshSettingsCache: mockRefreshSettingsCache,
}));

vi.mock("@/lib/config-guards/config-guard-cache", () => ({
  setConfiguredGuardCache: mockSetConfiguredGuardCache,
}));

import { useOnboarding } from "./use-onboarding";

describe("useOnboarding initial state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preselects the first provider and its default model", () => {
    const firstProvider = AVAILABLE_PROVIDERS[0];
    if (!firstProvider) {
      throw new Error("Provider list must not be empty");
    }

    const { result } = renderHook(() => useOnboarding());

    expect(result.current.wizardData.provider).toBe(firstProvider.id);
    expect(result.current.wizardData.model).toBe(firstProvider.defaultModel ?? null);
  });

  it("marks app as configured after successful completion", async () => {
    mockSaveSettings.mockResolvedValue(undefined);
    mockSaveConfig.mockResolvedValue(undefined);
    mockRefresh.mockResolvedValue(undefined);
    mockRefreshSettingsCache.mockResolvedValue(undefined);

    const { result } = renderHook(() => useOnboarding());
    await result.current.complete();

    expect(mockSaveSettings).toHaveBeenCalledTimes(1);
    expect(mockSaveConfig).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledWith(true);
    expect(mockRefreshSettingsCache).toHaveBeenCalledTimes(1);
    expect(mockSetConfiguredGuardCache).toHaveBeenCalledWith(true);
  });
});
