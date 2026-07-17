import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/testing/render";

interface HoistedMocks {
  mockNavigate: ReturnType<typeof vi.fn>;
  mockSaveSettings: ReturnType<typeof vi.fn>;
  mockSettingsQuery: {
    current: {
      data: { secretsStorage: "file" | "keyring" };
      error: Error | null;
      isLoading: boolean;
    };
  };
  mockIsSaving: { current: boolean };
}

const { mockNavigate, mockSaveSettings, mockSettingsQuery, mockIsSaving } = vi.hoisted(
  (): HoistedMocks => ({
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
  }),
);

// Boundary mock: Router is the routing library; tests provide a stub Router context so navigation assertions can be made without a real route tree.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

// Boundary mock: api/hooks is the HTTP-data fetch boundary; we provide canned data and assert on the resulting UI.
vi.mock("@diffgazer/core/api/hooks", async () => {
  const actual = await vi.importActual<typeof import("@diffgazer/core/api/hooks")>(
    "@diffgazer/core/api/hooks",
  );

  return {
    ...actual,
    useSettings: () => mockSettingsQuery.current,
    useSaveSettings: () => ({
      isPending: mockIsSaving.current,
      mutateAsync: mockSaveSettings,
    }),
  };
});

import { SettingsStoragePage } from "./page";

function renderPage() {
  return renderWithProviders(<SettingsStoragePage />);
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

  it("keeps radio focus and ArrowDown navigation after pointer re-entry from footer actions", async () => {
    const user = userEvent.setup();
    renderPage();

    const fileRadio = screen.getByRole("radio", { name: /file storage/i });
    const keyringRadio = screen.getByRole("radio", { name: /system keyring/i });
    await waitFor(() => expect(fileRadio).toHaveFocus());

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.click(fileRadio);
    expect(fileRadio).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(keyringRadio).toHaveFocus();
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

  it("renders query errors in the form shell without mounting storage content", () => {
    mockSettingsQuery.current = {
      data: { secretsStorage: "file" },
      error: new Error("Unable to load settings"),
      isLoading: false,
    };

    renderPage();

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load settings");
    expect(screen.queryByText("Changes will take effect immediately after saving.")).toBeNull();
  });
});
