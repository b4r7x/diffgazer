import { type BoundApi, createApi } from "@diffgazer/core/api";
import type { InitResponse, SettingsConfig } from "@diffgazer/core/schemas/config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

// Reset config-guard-cache module state between tests via vi.resetModules() + re-import.
// useOnboarding (which writes the cache on completion) and every @diffgazer/@-aliased
// participant in the rendered tree are re-imported together so they share one fresh module
// graph — vi.resetModules() re-evaluates the transformed app graph, so a statically-held
// context object (ApiProvider/ConfigProvider) would mismatch its consumer.
let useOnboarding: typeof import("./use-onboarding").useOnboarding;
let useSettings: typeof import("@diffgazer/core/api/hooks").useSettings;
let ApiProvider: typeof import("@diffgazer/core/api/hooks").ApiProvider;
let ConfigProvider: typeof import("@/hooks/use-config").ConfigProvider;

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
let mockDeleteProviderCredentials: Mock<BoundApi["deleteProviderCredentials"]>;
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
    deleteProviderCredentials: mockDeleteProviderCredentials,
    loadInit: mockLoadInit,
    getProviderStatus: mockGetProviderStatus,
  } satisfies BoundApi;

  return ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ApiProvider, { value: api }, createElement(ConfigProvider, null, children)),
    );
}

describe("onboarding/settings synchronization", () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ useSettings, ApiProvider } = await import("@diffgazer/core/api/hooks"));
    ({ useOnboarding } = await import("./use-onboarding"));
    ({ ConfigProvider } = await import("@/hooks/use-config"));
    mockGetSettings = vi.fn<BoundApi["getSettings"]>().mockResolvedValue(SETTINGS_FIXTURE);
    mockSaveSettings = vi.fn<BoundApi["saveSettings"]>().mockResolvedValue(undefined);
    mockSaveConfig = vi.fn<BoundApi["saveConfig"]>().mockResolvedValue(undefined);
    mockDeleteProviderCredentials = vi
      .fn<BoundApi["deleteProviderCredentials"]>()
      .mockResolvedValue({ deleted: true, provider: "openrouter" });
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

    mockGetSettings.mockResolvedValueOnce(SETTINGS_FIXTURE).mockResolvedValue(updatedSettings);

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

  it("uses canonical early-save refs and keeps cleanup retryable after deletion failure", async () => {
    mockDeleteProviderCredentials
      .mockRejectedValueOnce(new Error("cleanup failed"))
      .mockResolvedValueOnce({ deleted: true, provider: "openrouter" });

    const wrapper = createWrapper();
    const onboardingHook = renderHook(() => useOnboarding(), { wrapper });

    act(() => onboardingHook.result.current.next());
    act(() => onboardingHook.result.current.setProvider("openrouter"));
    act(() => onboardingHook.result.current.next());
    act(() =>
      onboardingHook.result.current.updateData({
        inputMethod: "env",
        apiKey: "ignored",
      }),
    );

    await act(async () => {
      onboardingHook.result.current.next();
    });

    expect(mockSaveConfig).toHaveBeenCalledWith({
      provider: "openrouter",
      apiKey: { kind: "env", varName: "OPENROUTER_API_KEY" },
    });

    let cleanupError: unknown;
    await act(async () => {
      try {
        await onboardingHook.result.current.cleanupEarlySave();
      } catch (error) {
        cleanupError = error;
      }
    });

    expect(cleanupError).toBeInstanceOf(Error);
    expect((cleanupError as Error).message).toBe("cleanup failed");
    expect(onboardingHook.result.current.error).toContain("Failed to remove saved credentials");

    await act(async () => {
      await onboardingHook.result.current.cleanupEarlySave();
    });

    expect(mockDeleteProviderCredentials).toHaveBeenCalledTimes(2);
    expect(onboardingHook.result.current.error).toBeNull();
  });
});
