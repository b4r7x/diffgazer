import { type BoundApi, createApi } from "@diffgazer/core/api";
import type { InitResponse, SettingsConfig } from "@diffgazer/core/schemas/config";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const toastError = vi.fn();

// Boundary mock: @diffgazer/ui toast is an external notification side-effect; cleanup failures report through it instead of component state.
vi.mock("@diffgazer/ui/components/toast", () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

// vi.resetModules() + re-import keeps the rendered tree on one fresh module graph:
// useOnboarding and every @diffgazer/@-aliased participant are re-imported together so a
// statically-held context object (ApiProvider/ConfigProvider) cannot mismatch its consumer
// after the graph is re-evaluated.
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
    configPath: "/tmp/diffgazer/config.json",
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

function createWrapper() {
  const api = {
    ...createApi({ baseUrl: "http://localhost" }),
    getSettings: mockGetSettings,
    saveSettings: mockSaveSettings,
    saveConfig: mockSaveConfig,
    deleteProviderCredentials: mockDeleteProviderCredentials,
    loadInit: mockLoadInit,
    getProviderStatus: mockGetProviderStatus,
  } satisfies BoundApi;
  const { Wrapper } = createTestQueryWrapper({ api, ApiProvider });

  return ({ children }: { children: ReactNode }) =>
    createElement(Wrapper, null, createElement(ConfigProvider, null, children));
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

  it("persists storage before credentials in the canonical early save", async () => {
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

    expect(mockSaveSettings.mock.invocationCallOrder[0]).toBeLessThan(
      mockSaveConfig.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(mockSaveSettings).toHaveBeenCalledWith({ secretsStorage: "file" });
    expect(mockSaveConfig).toHaveBeenCalledWith({
      provider: "openrouter",
      apiKey: { kind: "env", varName: "OPENROUTER_API_KEY" },
    });
  });

  it("reports an abandon-cleanup failure through a toast without rethrowing", async () => {
    mockDeleteProviderCredentials.mockRejectedValueOnce(new Error("cleanup failed"));

    const wrapper = createWrapper();
    const onboardingHook = renderHook(() => useOnboarding(), { wrapper });

    act(() => onboardingHook.result.current.next());
    act(() => onboardingHook.result.current.setProvider("openrouter"));
    act(() => onboardingHook.result.current.next());
    act(() => onboardingHook.result.current.updateData({ inputMethod: "env", apiKey: "ignored" }));

    await act(async () => {
      onboardingHook.result.current.next();
    });

    let threw = false;
    await act(async () => {
      try {
        await onboardingHook.result.current.cleanupEarlySave();
      } catch {
        threw = true;
      }
    });

    expect(threw).toBe(false);
    expect(toastError).toHaveBeenCalledWith(
      "Cleanup Failed",
      expect.objectContaining({
        message: expect.stringContaining("Failed to remove saved credentials"),
      }),
    );
  });
});
