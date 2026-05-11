import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyboardProvider } from "@diffgazer/keys";
import { FooterProvider } from "@/components/layout";

type QueryStateHandlers = {
  loading: () => unknown;
  error: (error: Error) => unknown;
  success: () => unknown;
};

const {
  mockNavigate,
  mockSaveSettings,
  mockSettingsQuery,
  mockIsSaving,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSaveSettings: vi.fn(),
  mockSettingsQuery: {
    current: {
      data: { secretsStorage: "file" },
      error: null,
      isLoading: false,
    },
  },
  mockIsSaving: { current: false },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@diffgazer/core/api/hooks", () => ({
  useSettings: () => mockSettingsQuery.current,
  useSaveSettings: () => ({
    isPending: mockIsSaving.current,
    mutateAsync: mockSaveSettings,
  }),
  matchQueryState: (
    query: { isLoading?: boolean; error?: Error | null },
    handlers: QueryStateHandlers,
  ) => {
    if (query.isLoading) return handlers.loading();
    if (query.error) return handlers.error(query.error);
    return handlers.success();
  },
}));

import { SettingsStoragePage } from "./page";

function renderPage() {
  return render(
    <FooterProvider>
      <KeyboardProvider>
        <SettingsStoragePage />
      </KeyboardProvider>
    </FooterProvider>,
  );
}

describe("SettingsStoragePage keyboard behavior", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSaveSettings.mockReset();
    mockSaveSettings.mockResolvedValue(undefined);
    mockSettingsQuery.current = {
      data: { secretsStorage: "file" },
      error: null,
      isLoading: false,
    };
    mockIsSaving.current = false;
  });

  it("does not move footer focus onto a disabled save action", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /file storage/i })).toHaveFocus();
    });

    await user.keyboard("{ArrowDown}{ArrowDown}");

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const save = screen.getByRole("button", { name: "Save" });
    expect(cancel).toHaveFocus();
    expect(save).toBeDisabled();

    await user.keyboard("{ArrowRight}");

    expect(cancel).toHaveFocus();
    expect(save).not.toHaveFocus();
  });

  it("focuses and activates save after the storage choice changes", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /file storage/i })).toHaveFocus();
    });

    await user.keyboard("{ArrowDown} {ArrowDown}{ArrowRight}{Enter}");

    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    expect(mockSaveSettings).toHaveBeenCalledWith({ secretsStorage: "keyring" });
  });
});
