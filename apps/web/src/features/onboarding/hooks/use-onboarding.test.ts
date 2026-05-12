import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { AVAILABLE_PROVIDERS } from "@diffgazer/core/schemas/config";

const {
  mockRefresh,
  mockSaveSettingsMutateAsync,
  mockSaveConfigMutateAsync,
  mockSetConfiguredGuardCache,
} = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockSaveSettingsMutateAsync: vi.fn(),
  mockSaveConfigMutateAsync: vi.fn(),
  mockSetConfiguredGuardCache: vi.fn(),
}));

// Kept: useConfigActions requires ConfigProvider which needs the full
// QueryClientProvider + ApiProvider + ConfigProvider chain with useInit,
// useProviderStatus, etc. Disproportionate for a wizard state-management test.
vi.mock("@/app/providers/config-provider", () => ({
  useConfigActions: () => ({
    refresh: mockRefresh,
  }),
}));

vi.mock("@diffgazer/core/api/hooks", () => ({
  useSaveSettings: () => ({
    mutateAsync: mockSaveSettingsMutateAsync,
    isPending: false,
  }),
  useSaveConfig: () => ({
    mutateAsync: mockSaveConfigMutateAsync,
    isPending: false,
  }),
}));

// Kept: module-level mutable state — mock avoids cross-test side effects.
vi.mock("@/lib/config-guards/config-guard-cache", () => ({
  setConfiguredGuardCache: mockSetConfiguredGuardCache,
}));

import { useOnboarding } from "./use-onboarding";

describe("useOnboarding", () => {
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
    const firstProvider = AVAILABLE_PROVIDERS[0];
    if (!firstProvider) {
      throw new Error("Provider list must not be empty");
    }

    mockSaveSettingsMutateAsync.mockResolvedValue(undefined);
    mockSaveConfigMutateAsync.mockResolvedValue(undefined);
    mockRefresh.mockResolvedValue(undefined);

    const { result } = renderHook(() => useOnboarding());
    await result.current.complete();

    expect(mockSaveSettingsMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ secretsStorage: "file" }),
    );
    expect(mockSaveConfigMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ provider: firstProvider.id }),
    );
    expect(mockRefresh).toHaveBeenCalledWith(true);
    expect(mockSetConfiguredGuardCache).toHaveBeenCalledWith(true);
  });

  it("saves onboarding payloads from the selected wizard settings", async () => {
    mockSaveSettingsMutateAsync.mockResolvedValue(undefined);
    mockSaveConfigMutateAsync.mockResolvedValue(undefined);
    mockRefresh.mockResolvedValue(undefined);

    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.updateData({
        secretsStorage: "keyring",
        provider: "gemini",
        inputMethod: "env",
        apiKey: "ignored-paste-value",
        model: "gemini-2.5-pro",
        defaultLenses: ["security"],
        agentExecution: "parallel",
      });
    });

    await act(async () => {
      await result.current.complete();
    });

    expect(mockSaveSettingsMutateAsync).toHaveBeenCalledWith({
      secretsStorage: "keyring",
      defaultLenses: ["security"],
      agentExecution: "parallel",
    });
    expect(mockSaveConfigMutateAsync).toHaveBeenCalledWith({
      provider: "gemini",
      apiKey: "env",
      model: "gemini-2.5-pro",
    });
  });

  it("exposes submitting state while completion is pending", async () => {
    let resolveConfig: (() => void) | undefined;
    mockSaveSettingsMutateAsync.mockResolvedValue(undefined);
    mockSaveConfigMutateAsync.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveConfig = resolve;
      }),
    );
    mockRefresh.mockResolvedValue(undefined);

    const { result } = renderHook(() => useOnboarding());
    let completion = Promise.resolve();

    await act(async () => {
      completion = result.current.complete();
      await Promise.resolve();
    });

    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      resolveConfig?.();
      await completion;
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it("keeps the setup incomplete and reports errors when completion fails", async () => {
    mockSaveSettingsMutateAsync.mockResolvedValue(undefined);
    mockSaveConfigMutateAsync.mockRejectedValue(new Error("Save failed"));

    const { result } = renderHook(() => useOnboarding());

    await act(async () => {
      await expect(result.current.complete()).rejects.toThrow("Save failed");
    });

    expect(result.current.error).toBe("Save failed");
    expect(result.current.isSubmitting).toBe(false);
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockSetConfiguredGuardCache).not.toHaveBeenCalled();
  });
});
