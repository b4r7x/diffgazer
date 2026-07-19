import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/testing/render";

const { allLenses, mockNavigate, mockSaveSettings, mockSettingsQuery, mockIsSaving } = vi.hoisted(
  () => {
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
  },
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

import { SettingsAnalysisPage } from "./page";

function renderPage() {
  return renderWithProviders(<SettingsAnalysisPage />);
}

async function moveFromSelectedLensToFooter(user: ReturnType<typeof userEvent.setup>) {
  const agentsGroup = screen.getByRole("group", { name: /active agents/i });
  await user.keyboard("{ArrowDown}".repeat(within(agentsGroup).getAllByRole("checkbox").length));
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
      const agentsGroup = screen.getByRole("group", { name: /active agents/i });
      expect(within(agentsGroup).getByRole("checkbox", { name: /detective/i })).toHaveFocus();
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

  it("uses every lens as the untouched fallback when persisted defaults are empty", () => {
    mockSettingsQuery.current = {
      data: { defaultLenses: [] },
      error: null,
      isLoading: false,
    };

    renderPage();

    const agentsGroup = screen.getByRole("group", { name: /active agents/i });
    expect(within(agentsGroup).getAllByRole("checkbox", { checked: true })).toHaveLength(
      allLenses.length,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("focuses and activates save after the lens selection changes", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      const agentsGroup = screen.getByRole("group", { name: /active agents/i });
      expect(within(agentsGroup).getByRole("checkbox", { name: /detective/i })).toHaveFocus();
    });

    await user.keyboard("{Enter}");
    await moveFromSelectedLensToFooter(user);
    await user.keyboard("{ArrowRight}{Enter}");

    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    expect(mockSaveSettings).toHaveBeenCalledWith({
      defaultLenses: ["security", "performance", "simplicity", "tests"],
    });
  });

  it("keeps one associated live validation node while the final lens is removed and restored", async () => {
    const user = userEvent.setup();
    renderPage();
    const group = screen.getByRole("group", { name: /active agents/i });
    const liveRegion = screen.getByRole("status");

    expect(group.querySelector('[data-slot="checkbox-group-validation"]')).toBeRequired();
    expect(group).toHaveAttribute("aria-describedby", liveRegion.id);
    expect(liveRegion).toHaveTextContent("");

    for (const checkbox of within(group).getAllByRole("checkbox")) {
      await user.click(checkbox);
    }

    expect(screen.getByRole("status")).toBe(liveRegion);
    expect(liveRegion).toHaveTextContent("Select at least one lens.");
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    const firstCheckbox = within(group).getAllByRole("checkbox")[0];
    if (!firstCheckbox) throw new Error("Expected at least one analysis lens");
    await user.click(firstCheckbox);

    expect(screen.getByRole("status")).toBe(liveRegion);
    expect(liveRegion).toHaveTextContent("");
    expect(group).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });
});
