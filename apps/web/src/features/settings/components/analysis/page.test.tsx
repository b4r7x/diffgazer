import { SETTINGS_SCREEN_COPY } from "@diffgazer/core/schemas/config";
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
          data: { defaultLenses: lensIds, effectiveCallTokenCap: 49_152 },
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
  const lensGroup = screen.getByRole("group", { name: /active lenses/i });
  // One ArrowDown per lens reaches the token cap input below the list; one more
  // leaves the input for the footer actions.
  await user.keyboard("{ArrowDown}".repeat(within(lensGroup).getAllByRole("checkbox").length + 1));
}

describe("SettingsAnalysisPage keyboard behavior", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSaveSettings.mockReset();
    mockSaveSettings.mockResolvedValue(undefined);
    mockSettingsQuery.current = {
      data: { defaultLenses: allLenses, effectiveCallTokenCap: 49_152 },
      error: null,
      isLoading: false,
    };
    mockIsSaving.current = false;
  });

  it("heads the page with the shared settings copy", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: SETTINGS_SCREEN_COPY.analysis.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(SETTINGS_SCREEN_COPY.analysis.subtitle)).toBeInTheDocument();
  });

  it("does not move footer focus onto a disabled save action", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      const lensGroup = screen.getByRole("group", { name: /active lenses/i });
      expect(within(lensGroup).getByRole("checkbox", { name: /detective/i })).toHaveFocus();
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

  it("keeps checkbox focus and ArrowDown navigation after pointer re-entry from footer actions", async () => {
    const user = userEvent.setup();
    renderPage();

    const lensGroup = screen.getByRole("group", { name: /active lenses/i });
    const [firstLens, secondLens] = within(lensGroup).getAllByRole("checkbox");
    if (!firstLens || !secondLens) throw new Error("Expected at least two analysis lenses");
    await waitFor(() => expect(firstLens).toHaveFocus());

    await moveFromSelectedLensToFooter(user);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(lensGroup).not.toHaveAttribute("aria-disabled");

    await user.click(firstLens);
    expect(firstLens).toHaveAttribute("aria-checked", "false");
    expect(firstLens).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(secondLens).toHaveFocus();
  });

  it("uses every lens as the untouched fallback when persisted defaults are empty", () => {
    mockSettingsQuery.current = {
      data: { defaultLenses: [], effectiveCallTokenCap: 49_152 },
      error: null,
      isLoading: false,
    };

    renderPage();

    const lensGroup = screen.getByRole("group", { name: /active lenses/i });
    expect(within(lensGroup).getAllByRole("checkbox", { checked: true })).toHaveLength(
      allLenses.length,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("focuses and activates save after the lens selection changes", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      const lensGroup = screen.getByRole("group", { name: /active lenses/i });
      expect(within(lensGroup).getByRole("checkbox", { name: /detective/i })).toHaveFocus();
    });

    await user.keyboard("{Enter}");
    await moveFromSelectedLensToFooter(user);
    await user.keyboard("{ArrowRight}{Enter}");

    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    expect(mockSaveSettings).toHaveBeenCalledWith({
      defaultLenses: ["security", "performance", "simplicity", "tests"],
      effectiveCallTokenCap: 49_152,
    });
  });

  it("keeps one associated live validation node while the final lens is removed and restored", async () => {
    const user = userEvent.setup();
    renderPage();
    const group = screen.getByRole("group", { name: /active lenses/i });
    const liveRegion = screen.getByRole("status");

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

  it("saves an edited per-call token cap through the settings payload", async () => {
    const user = userEvent.setup();
    renderPage();

    const capInput = screen.getByRole("textbox", { name: /per-call token cap/i });
    expect(capInput).toHaveValue("");

    await user.type(capInput, "65536");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(mockSaveSettings).toHaveBeenCalledWith({
      defaultLenses: allLenses,
      effectiveCallTokenCap: 65_536,
    });
  });

  it("shows the default cap as an empty input with the default in the placeholder", () => {
    renderPage();

    const capInput = screen.getByRole("textbox", { name: /per-call token cap/i });
    expect(capInput).toHaveValue("");
    expect(capInput).toHaveAttribute("placeholder", "49,152 (default)");
    expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
  });

  it("shows a persisted override and resets it back to the default", async () => {
    mockSettingsQuery.current = {
      data: { defaultLenses: allLenses, effectiveCallTokenCap: 65_536 },
      error: null,
      isLoading: false,
    };
    const user = userEvent.setup();
    renderPage();

    const capInput = screen.getByRole("textbox", { name: /per-call token cap/i });
    expect(capInput).toHaveValue("65536");

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(capInput).toHaveValue("");
    expect(capInput).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(mockSaveSettings).toHaveBeenCalledWith({
      defaultLenses: allLenses,
      effectiveCallTokenCap: 49_152,
    });
  });

  it("navigates the cap row with arrows: input to Reset, back, and footer up to the input", async () => {
    mockSettingsQuery.current = {
      data: { defaultLenses: allLenses, effectiveCallTokenCap: 65_536 },
      error: null,
      isLoading: false,
    };
    const user = userEvent.setup();
    renderPage();

    const capInput = screen.getByRole("textbox", { name: /per-call token cap/i });
    const reset = screen.getByRole("button", { name: "Reset" });

    await user.click(capInput);
    await user.keyboard("{End}{ArrowRight}");
    expect(reset).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(capInput).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(capInput).toHaveFocus();
  });

  it("clears the lens highlight while the token cap input has focus", async () => {
    const user = userEvent.setup();
    renderPage();

    const lensGroup = screen.getByRole("group", { name: /active lenses/i });
    const checkboxes = within(lensGroup).getAllByRole("checkbox");
    const lastLens = checkboxes.at(-1);
    if (!lastLens) throw new Error("Expected at least one analysis lens");
    await waitFor(() => expect(checkboxes[0]).toHaveFocus());

    await user.keyboard("{ArrowDown}".repeat(checkboxes.length - 1));
    expect(lastLens).toHaveFocus();
    expect(lastLens).toHaveAttribute("data-highlighted");

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("textbox", { name: /per-call token cap/i })).toHaveFocus();
    expect(lastLens).not.toHaveAttribute("data-highlighted");

    await user.keyboard("{ArrowUp}");
    expect(lastLens).toHaveFocus();
    expect(lastLens).toHaveAttribute("data-highlighted");
  });

  it("shows the field error instead of saving for an out-of-range token cap", async () => {
    const user = userEvent.setup();
    renderPage();

    const capInput = screen.getByRole("textbox", { name: /per-call token cap/i });
    await user.type(capInput, "999");

    expect(capInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a whole number between 16,384 and 1,048,576.",
    );
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await user.click(save);
    expect(mockSaveSettings).not.toHaveBeenCalled();
  });
});
