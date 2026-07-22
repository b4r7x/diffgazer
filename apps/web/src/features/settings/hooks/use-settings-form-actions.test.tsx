// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFooter, mockIsSaving, mockNavigate, mockSaveSettings, mockUseKey } = vi.hoisted(() => ({
  mockFooter: vi.fn(() => ({ inActions: false })),
  mockIsSaving: { current: false },
  mockNavigate: vi.fn(),
  mockSaveSettings: vi.fn(),
  mockUseKey: vi.fn(),
}));

vi.mock("@diffgazer/core/api/hooks", () => ({
  useSaveSettings: () => ({
    isPending: mockIsSaving.current,
    mutateAsync: mockSaveSettings,
  }),
}));

vi.mock("@diffgazer/keys", () => ({ useKey: mockUseKey }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mockNavigate }));
vi.mock("./use-settings-form-footer", () => ({ useSettingsFormFooter: mockFooter }));

import { useSettingsFormActions } from "./use-settings-form-actions";

describe("useSettingsFormActions", () => {
  beforeEach(() => {
    mockFooter.mockClear();
    mockIsSaving.current = false;
    mockNavigate.mockReset();
    mockSaveSettings.mockReset();
    mockUseKey.mockClear();
  });

  it("does not create or save a payload while saving is unavailable", async () => {
    const getSettingsPayload = vi.fn(() => ({ agentExecution: "parallel" as const }));
    const { result } = renderHook(() =>
      useSettingsFormActions({
        canSave: false,
        getSettingsPayload,
        contentShortcuts: [],
      }),
    );

    await act(() => result.current.onSave());

    expect(getSettingsPayload).not.toHaveBeenCalled();
    expect(mockSaveSettings).not.toHaveBeenCalled();
    expect(result.current.canSave).toBe(false);
  });

  it("does not create or save a payload while a mutation is already pending", async () => {
    mockIsSaving.current = true;
    const getSettingsPayload = vi.fn(() => ({ agentExecution: "parallel" as const }));
    const { result } = renderHook(() =>
      useSettingsFormActions({
        canSave: true,
        getSettingsPayload,
        contentShortcuts: [],
      }),
    );

    await act(() => result.current.onSave());

    expect(result.current.canSave).toBe(false);
    expect(getSettingsPayload).not.toHaveBeenCalled();
    expect(mockSaveSettings).not.toHaveBeenCalled();
  });

  it("saves the page payload and navigates only after the mutation succeeds", async () => {
    mockSaveSettings.mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useSettingsFormActions({
        canSave: true,
        getSettingsPayload: () => ({ secretsStorage: "keyring" }),
        contentShortcuts: [],
      }),
    );

    await act(() => result.current.onSave());

    expect(mockSaveSettings).toHaveBeenCalledWith({ secretsStorage: "keyring" });
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });

  it("surfaces a save error, then clears it on a successful retry", async () => {
    mockSaveSettings.mockRejectedValueOnce(new Error("Settings store is read-only"));
    const { result } = renderHook(() =>
      useSettingsFormActions({
        canSave: true,
        getSettingsPayload: () => ({ agentExecution: "sequential" }),
        contentShortcuts: [],
      }),
    );

    await act(() => result.current.onSave());
    expect(result.current.error).toBe("Settings store is read-only");
    expect(mockNavigate).not.toHaveBeenCalled();

    mockSaveSettings.mockResolvedValueOnce(undefined);
    await act(() => result.current.onSave());

    expect(result.current.error).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });
});
