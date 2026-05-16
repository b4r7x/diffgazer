import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createApi, type BoundApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import type { InitResponse, SettingsConfig } from "@diffgazer/core/schemas/config";
import { createElement, type ReactNode } from "react";

import { ConfigProvider } from "@/app/providers/config-provider";
import { invalidateConfigGuardCache } from "@/lib/config-guard-cache";
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

function makeInitResponse(overrides: Partial<InitResponse> = {}): InitResponse {
  return {
    config: { provider: "gemini", model: "gemini-2.5-flash" },
    providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
    settings: SETTINGS_FIXTURE,
    configured: true,
    project: { projectId: "proj-1", path: "/tmp/repo", trust: null },
    setup: {
      hasSecretsStorage: true,
      hasProvider: true,
      hasModel: true,
      hasTrust: false,
      isConfigured: true,
      isReady: true,
      missing: [],
    },
    ...overrides,
  };
}

let mockGetSettings: Mock<BoundApi["getSettings"]>;
let mockSaveSettings: Mock<BoundApi["saveSettings"]>;
let mockSaveConfig: Mock<BoundApi["saveConfig"]>;
let mockLoadInit: Mock<BoundApi["loadInit"]>;
let mockGetProviderStatus: Mock<BoundApi["getProviderStatus"]>;
let queryClient: QueryClient;

function createWrapper() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const api = {
    ...createApi({ baseUrl: "http://localhost" }),
    getSettings: mockGetSettings,
    saveSettings: mockSaveSettings,
    saveConfig: mockSaveConfig,
    loadInit: mockLoadInit,
    getProviderStatus: mockGetProviderStatus,
  } satisfies BoundApi;

  return ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        ApiProvider,
        { value: api },
        createElement(ConfigProvider, null, children),
      ),
    );
}

describe("onboarding/settings synchronization", () => {
  beforeEach(() => {
    invalidateConfigGuardCache();
    mockGetSettings = vi.fn<BoundApi["getSettings"]>().mockResolvedValue(SETTINGS_FIXTURE);
    mockSaveSettings = vi.fn<BoundApi["saveSettings"]>().mockResolvedValue(undefined);
    mockSaveConfig = vi.fn<BoundApi["saveConfig"]>().mockResolvedValue(undefined);
    mockLoadInit = vi.fn<BoundApi["loadInit"]>().mockResolvedValue(makeInitResponse());
    mockGetProviderStatus = vi
      .fn<BoundApi["getProviderStatus"]>()
      .mockResolvedValue([{ provider: "gemini", hasApiKey: true, isActive: true }]);
  });

  it("invalidates the settings query after onboarding completes", async () => {
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
  });
});
