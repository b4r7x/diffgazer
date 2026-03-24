import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { AVAILABLE_PROVIDERS } from "@diffgazer/schemas/config";

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

vi.mock("@/app/providers/config-provider", () => ({
  useConfigActions: () => ({
    refresh: mockRefresh,
  }),
}));

vi.mock("@diffgazer/api/hooks", () => ({
  useSaveSettings: () => ({
    mutateAsync: mockSaveSettingsMutateAsync,
    isPending: false,
  }),
  useSaveConfig: () => ({
    mutateAsync: mockSaveConfigMutateAsync,
    isPending: false,
  }),
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
    mockSaveSettingsMutateAsync.mockResolvedValue(undefined);
    mockSaveConfigMutateAsync.mockResolvedValue(undefined);
    mockRefresh.mockResolvedValue(undefined);

    const { result } = renderHook(() => useOnboarding());
    await result.current.complete();

    expect(mockSaveSettingsMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockSaveConfigMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledWith(true);
    expect(mockSetConfiguredGuardCache).toHaveBeenCalledWith(true);
  });
});
