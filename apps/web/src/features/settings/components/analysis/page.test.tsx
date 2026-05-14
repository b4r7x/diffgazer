import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/testing";

const {
  allLenses,
  mockNavigate,
  mockSaveSettings,
  mockSettingsQuery,
  mockIsSaving,
} = vi.hoisted(() => {
  const lensIds = ["correctness", "security", "performance", "simplicity", "tests"];
  return {
    allLenses: lensIds,
    mockNavigate: vi.fn(),
    mockSaveSettings: vi.fn(),
    mockSettingsQuery: {
      current: {
        data: { defaultLenses: lensIds },
        error: null,
        isLoading: false,
      },
    },
    mockIsSaving: { current: false },
  };
});

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

type QueryStateHandlers = {
  loading: () => unknown;
  error: (error: Error) => unknown;
  success: () => unknown;
};

// Boundary mock: api/hooks is the HTTP-data fetch boundary; we provide canned data and assert on the resulting UI.
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

import { SettingsAnalysisPage } from "./page";

function renderPage() {
  return renderWithProviders(<SettingsAnalysisPage />);
}

async function moveFromSelectedLensToFooter(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard("{ArrowDown}".repeat(screen.getAllByRole("checkbox").length));
}

describe("SettingsAnalysisPage keyboard behavior", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSaveSettings.mockReset();
    mockSaveSettings.mockResolvedValue(undefined);
    mockSettingsQuery.current = {
      data: { defaultLenses: allLenses },
      error: null,
      isLoading: false,
    };
    mockIsSaving.current = false;
  });

  it("does not move footer focus onto a disabled save action", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: /detective/i })).toHaveFocus();
    });

    await moveFromSelectedLensToFooter(user);

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const save = screen.getByRole("button", { name: "Save" });
    expect(cancel).toHaveFocus();
    expect(save).toBeDisabled();

    await user.keyboard("{ArrowRight}");

    expect(cancel).toHaveFocus();
    expect(save).not.toHaveFocus();
  });

  it("focuses and activates save after the lens selection changes", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: /detective/i })).toHaveFocus();
    });

    await user.keyboard("{Enter}");
    await moveFromSelectedLensToFooter(user);
    await user.keyboard("{ArrowRight}{Enter}");

    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    expect(mockSaveSettings).toHaveBeenCalledWith({
      defaultLenses: ["security", "performance", "simplicity", "tests"],
    });
  });
});
