/**
 * @vitest-environment jsdom
 */
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { NavigationProvider } from "../../../app/providers/navigation-provider";
import { useOnboardingWizard } from "./use-wizard";

let mockSaveSettings: Mock<BoundApi["saveSettings"]>;
let mockSaveConfig: Mock<BoundApi["saveConfig"]>;
let mockDeleteProviderCredentials: Mock<BoundApi["deleteProviderCredentials"]>;

function createWrapper() {
  const api = {
    ...createApi({ baseUrl: "http://localhost" }),
    saveSettings: mockSaveSettings,
    saveConfig: mockSaveConfig,
    deleteProviderCredentials: mockDeleteProviderCredentials,
  } satisfies BoundApi;
  const { Wrapper: ApiWrapper } = createTestQueryWrapper({ api });

  return ({ children }: { children: ReactNode }) =>
    createElement(
      ApiWrapper,
      null,
      createElement(NavigationProvider, {
        initialRoute: { screen: "onboarding" },
        children,
      }),
    );
}

describe("useOnboardingWizard", () => {
  beforeEach(() => {
    mockSaveSettings = vi.fn<BoundApi["saveSettings"]>().mockResolvedValue(undefined);
    mockSaveConfig = vi.fn<BoundApi["saveConfig"]>().mockResolvedValue(undefined);
    mockDeleteProviderCredentials = vi
      .fn<BoundApi["deleteProviderCredentials"]>()
      .mockResolvedValue({ deleted: true, provider: "openrouter" });
  });

  it("saves storage before credentials and absorbs a cleanup failure without rethrowing", async () => {
    mockDeleteProviderCredentials.mockRejectedValueOnce(new Error("cleanup failed"));

    const wrapper = createWrapper();
    const hook = renderHook(() => useOnboardingWizard(), { wrapper });

    act(() => hook.result.current.handleNext());
    act(() => hook.result.current.handleProviderChange("openrouter"));
    act(() => hook.result.current.handleNext());
    act(() => hook.result.current.handleInputMethodChange("env"));
    act(() => hook.result.current.handleApiKeyChange("ignored"));

    await act(async () => {
      hook.result.current.handleNext();
    });

    expect(mockSaveSettings.mock.invocationCallOrder[0]).toBeLessThan(
      mockSaveConfig.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(mockSaveSettings).toHaveBeenCalledWith({ secretsStorage: "file" });
    expect(mockSaveConfig).toHaveBeenCalledWith({
      provider: "openrouter",
      apiKey: { kind: "env", varName: "OPENROUTER_API_KEY" },
    });

    let threw = false;
    await act(async () => {
      try {
        await hook.result.current.cleanupEarlySave();
      } catch {
        threw = true;
      }
    });

    expect(threw).toBe(false);
    expect(mockDeleteProviderCredentials).toHaveBeenCalledWith("openrouter");
  });

  it("surfaces a failed early save through the wizard error so the TUI can render it", async () => {
    mockSaveConfig.mockRejectedValueOnce(new Error("STORAGE_NOT_CONFIGURED"));

    const wrapper = createWrapper();
    const hook = renderHook(() => useOnboardingWizard(), { wrapper });

    act(() => hook.result.current.handleNext());
    act(() => hook.result.current.handleProviderChange("openrouter"));
    act(() => hook.result.current.handleNext());
    act(() => hook.result.current.handleInputMethodChange("env"));
    act(() => hook.result.current.handleApiKeyChange("ignored"));

    await act(async () => {
      hook.result.current.handleNext();
    });

    expect(hook.result.current.error).toBe("STORAGE_NOT_CONFIGURED");
    // The failed early save keeps the user on the api-key step.
    expect(hook.result.current.currentStep).toBe("api-key");
  });

  it("keeps Back and Next nav focus exclusive via navIndex", () => {
    const wrapper = createWrapper();
    const hook = renderHook(() => useOnboardingWizard(), { wrapper });

    act(() => hook.result.current.handleNext());
    act(() => hook.result.current.toggleFocusArea());

    expect(hook.result.current.navIndex).toBe(0);

    act(() => hook.result.current.moveNavIndex(1));
    expect(hook.result.current.navIndex).toBe(1);

    act(() => hook.result.current.moveNavIndex(-1));
    expect(hook.result.current.navIndex).toBe(0);
  });
});
