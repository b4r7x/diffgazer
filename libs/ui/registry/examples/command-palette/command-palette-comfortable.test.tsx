import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import CommandPaletteAutoTones from "./command-palette-auto-tones";
import CommandPaletteComfortable from "./command-palette-comfortable";
import CommandPaletteDemo from "./command-palette-demo";
import CommandPaletteDense from "./command-palette-dense";
import CommandPaletteTerminal from "./command-palette-terminal";
import CommandPaletteTones from "./command-palette-tones";
import CommandPaletteViewfinder from "./command-palette-viewfinder";

// Every variant example renders an embedded (modal={false}) palette so the open
// surface it documents is visible without interaction. Only the hero demo keeps
// the trigger-button flow.
const inlineExamples = [
  {
    name: "comfortable",
    Example: CommandPaletteComfortable,
    label: "Comfortable palette",
    search: "files",
    expectedItem: "Search files",
    expectedId: "search",
  },
  {
    name: "dense",
    Example: CommandPaletteDense,
    label: "Dense palette",
    search: "toggle sidebar",
    expectedItem: "Toggle sidebar",
    expectedId: "toggle-sidebar",
  },
  {
    name: "terminal",
    Example: CommandPaletteTerminal,
    label: "Terminal palette",
    search: "go to history",
    expectedItem: "Go to History",
    expectedId: "history",
  },
  {
    name: "tones",
    Example: CommandPaletteTones,
    label: "Toned palette",
    search: "assistant",
    expectedItem: "Ask the assistant",
    expectedId: "explain",
  },
  {
    name: "auto-tones",
    Example: CommandPaletteAutoTones,
    label: "Auto-toned palette",
    search: "deploy production",
    expectedItem: "Deploy production",
    expectedId: "deploy-prod",
  },
  {
    name: "viewfinder",
    Example: CommandPaletteViewfinder,
    label: "Viewfinder palette",
    search: "export pdf",
    expectedItem: "Export PDF",
    expectedId: "export",
  },
] as const;

describe("CommandPalette gallery examples", () => {
  it.each(
    inlineExamples,
  )("$name renders its open surface without interaction and filters by visible text", async ({
    Example,
    label,
    search,
    expectedItem,
    expectedId,
  }) => {
    const user = userEvent.setup();
    const { container } = render(<Example />);

    const palette = within(screen.getByRole("group", { name: label }));
    expect(palette.getAllByRole("option").length).toBeGreaterThan(1);

    await user.type(palette.getByRole("combobox", { name: "Command search" }), search);

    // toHaveTextContent (not getByText) because the auto-tone example splits
    // the label into per-match <mark> runs.
    const option = palette.getByRole("option");
    expect(option).toHaveTextContent(expectedItem);
    expect(option).toHaveAttribute("data-value", expectedId);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("keeps the hero demo on the trigger-driven modal flow", async () => {
    const user = userEvent.setup();
    render(<CommandPaletteDemo />);

    await user.click(screen.getByRole("button", { name: "Open Command Palette" }));
    const dialog = await screen.findByRole("dialog", { name: "Command palette" });
    await user.type(
      within(dialog).getByRole("combobox", { name: "Command search" }),
      "go to history",
    );

    const option = within(dialog).getByRole("option");
    expect(within(option).getByText("Go to History")).toBeInTheDocument();
    expect(option).toHaveAttribute("data-value", "history");
  });
});
