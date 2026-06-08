/**
 * @vitest-environment jsdom
 */
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("../../../hooks/use-navigation", () => ({
  useNavigation: () => ({ navigate: vi.fn() }),
}));

import { useOnboardingWizard } from "./use-wizard";

let mockSaveSettings: Mock<BoundApi["saveSettings"]>;
let mockSaveConfig: Mock<BoundApi["saveConfig"]>;
let mockDeleteProviderCredentials: Mock<BoundApi["deleteProviderCredentials"]>;
let queryClient: QueryClient;

function createWrapper() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const api = {
    ...createApi({ baseUrl: "http://localhost" }),
    saveSettings: mockSaveSettings,
    saveConfig: mockSaveConfig,
    deleteProviderCredentials: mockDeleteProviderCredentials,
  } satisfies BoundApi;

  return ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ApiProvider, { value: api }, children),
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

  it("uses canonical early-save refs and retries cleanup after deletion failure", async () => {
    mockDeleteProviderCredentials
      .mockRejectedValueOnce(new Error("cleanup failed"))
      .mockResolvedValueOnce({ deleted: true, provider: "openrouter" });

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

    expect(mockSaveConfig).toHaveBeenCalledWith({
      provider: "openrouter",
      apiKey: { kind: "env", varName: "OPENROUTER_API_KEY" },
    });

    let cleanupError: unknown;
    await act(async () => {
      try {
        await hook.result.current.cleanupEarlySave();
      } catch (error) {
        cleanupError = error;
      }
    });

    expect(cleanupError).toBeInstanceOf(Error);
    expect((cleanupError as Error).message).toBe("cleanup failed");
    expect(hook.result.current.error).toContain("Failed to remove saved credentials");

    await act(async () => {
      await hook.result.current.cleanupEarlySave();
    });

    expect(mockDeleteProviderCredentials).toHaveBeenCalledTimes(2);
    expect(hook.result.current.error).toBeNull();
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
