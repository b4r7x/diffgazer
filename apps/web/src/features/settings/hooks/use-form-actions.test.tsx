import { FooterProvider } from "@diffgazer/core/footer";
import { KeyboardProvider } from "@diffgazer/keys";
import { act, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockIsSaving, mockNavigate, mockSaveSettings } = vi.hoisted(() => ({
  mockIsSaving: { current: false },
  mockNavigate: vi.fn(),
  mockSaveSettings: vi.fn(),
}));

// Boundary mocks only: the settings mutation is the network edge and TanStack
// Router is the external routing library. `@diffgazer/keys` and the footer
// sibling run for real, so the Escape-cancel this hook advertises is exercised
// instead of stubbed.
vi.mock("@diffgazer/core/api/hooks", () => ({
  useSaveSettings: () => ({
    isPending: mockIsSaving.current,
    mutateAsync: mockSaveSettings,
  }),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mockNavigate }));

import { useSettingsFormActions } from "./use-form-actions";

type FormActionsOptions = Parameters<typeof useSettingsFormActions>[0];

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <FooterProvider>
      <KeyboardProvider>{children}</KeyboardProvider>
    </FooterProvider>
  );
}

function renderFormActions(options: FormActionsOptions) {
  return renderHook(() => useSettingsFormActions(options), { wrapper: Wrapper });
}

describe("useSettingsFormActions", () => {
  beforeEach(() => {
    mockIsSaving.current = false;
    mockNavigate.mockReset();
    mockSaveSettings.mockReset();
  });

  it("does not create or save a payload while saving is unavailable", async () => {
    const getSettingsPayload = vi.fn(() => ({ agentExecution: "parallel" as const }));
    const { result } = renderFormActions({
      saveAvailable: false,
      getSettingsPayload,
      contentShortcuts: [],
    });

    await act(() => result.current.onSave());

    expect(getSettingsPayload).not.toHaveBeenCalled();
    expect(mockSaveSettings).not.toHaveBeenCalled();
    expect(result.current.canSave).toBe(false);
  });

  it("does not create or save a payload while a mutation is already pending", async () => {
    mockIsSaving.current = true;
    const getSettingsPayload = vi.fn(() => ({ agentExecution: "parallel" as const }));
    const { result } = renderFormActions({
      saveAvailable: true,
      getSettingsPayload,
      contentShortcuts: [],
    });

    await act(() => result.current.onSave());

    expect(result.current.canSave).toBe(false);
    expect(getSettingsPayload).not.toHaveBeenCalled();
    expect(mockSaveSettings).not.toHaveBeenCalled();
  });

  it("saves the page payload and navigates only after the mutation succeeds", async () => {
    mockSaveSettings.mockResolvedValue(undefined);
    const { result } = renderFormActions({
      saveAvailable: true,
      getSettingsPayload: () => ({ secretsStorage: "keyring" }),
      contentShortcuts: [],
    });

    await act(() => result.current.onSave());

    expect(mockSaveSettings).toHaveBeenCalledWith({ secretsStorage: "keyring" });
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });

  it("does not pull the user back to settings when the page left during the save", async () => {
    let resolveSave: () => void = () => {};
    mockSaveSettings.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSave = resolve;
      }),
    );
    const { result, unmount } = renderFormActions({
      saveAvailable: true,
      getSettingsPayload: () => ({ secretsStorage: "keyring" }),
      contentShortcuts: [],
    });

    const saving = result.current.onSave();
    unmount();
    await act(async () => {
      resolveSave();
      await saving;
    });

    expect(mockSaveSettings).toHaveBeenCalledWith({ secretsStorage: "keyring" });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("surfaces a save error, then clears it on a successful retry", async () => {
    mockSaveSettings.mockRejectedValueOnce(new Error("Settings store is read-only"));
    const { result } = renderFormActions({
      saveAvailable: true,
      getSettingsPayload: () => ({ agentExecution: "sequential" }),
      contentShortcuts: [],
    });

    await act(() => result.current.onSave());
    expect(result.current.error).toBe("Settings store is read-only");
    expect(mockNavigate).not.toHaveBeenCalled();

    mockSaveSettings.mockResolvedValueOnce(undefined);
    await act(() => result.current.onSave());

    expect(result.current.error).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });

  it("cancels back to the settings hub when Escape is pressed", async () => {
    const user = userEvent.setup();
    renderFormActions({
      saveAvailable: true,
      getSettingsPayload: () => ({ agentExecution: "parallel" }),
      contentShortcuts: [],
    });

    await user.keyboard("{Escape}");

    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });

  it("leaves Escape inert while a save is in flight", async () => {
    mockIsSaving.current = true;
    const user = userEvent.setup();
    renderFormActions({
      saveAvailable: true,
      getSettingsPayload: () => ({ agentExecution: "parallel" }),
      contentShortcuts: [],
    });

    await user.keyboard("{Escape}");

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
