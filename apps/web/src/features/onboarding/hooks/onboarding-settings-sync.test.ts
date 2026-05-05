import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import type { SettingsConfig } from "@diffgazer/core/schemas/config";
import { createElement, type ReactNode } from "react";

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

vi.mock("@/lib/config-guards/config-guard-cache", () => ({
  setConfiguredGuardCache: vi.fn(),
}));

import { useOnboarding } from "./use-onboarding";
import { useSettings } from "@diffgazer/core/api/hooks";

const SETTINGS_FIXTURE: SettingsConfig = {
  theme: "terminal",
  defaultLenses: [],
  defaultProfile: null,
  severityThreshold: "low",
  secretsStorage: null,
  agentExecution: "parallel",
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const api = {
    getSettings: mockGetSettings,
    saveSettings: mockSaveSettings,
    saveConfig: mockSaveConfig,
  } as any;

  return ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ApiProvider, { value: api }, children),
    );
}

describe("onboarding/settings synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings.mockResolvedValue(SETTINGS_FIXTURE);
    mockRefresh.mockResolvedValue(undefined);
    mockSaveSettings.mockResolvedValue(undefined);
    mockSaveConfig.mockResolvedValue(undefined);
  });

  it("should invalidate settings query after onboarding completion", async () => {
    const updatedSettings: SettingsConfig = {
      ...SETTINGS_FIXTURE,
      secretsStorage: "file",
      agentExecution: "sequential",
    };

    mockGetSettings
      .mockResolvedValueOnce(SETTINGS_FIXTURE)
      .mockResolvedValue(updatedSettings);

    const wrapper = createWrapper();
    const settingsHook = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => {
      expect(settingsHook.result.current.data?.secretsStorage ?? null).toBe(null);
    });

    const onboardingHook = renderHook(() => useOnboarding(), { wrapper });

    await act(async () => {
      await onboardingHook.result.current.complete();
    });

    await waitFor(() => {
      expect(settingsHook.result.current.data?.secretsStorage).toBe("file");
      expect(settingsHook.result.current.data?.agentExecution).toBe("sequential");
    });

    expect(mockGetSettings.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
