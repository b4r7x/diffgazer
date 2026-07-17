import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import CommandPaletteComfortable from "./command-palette-comfortable";
import CommandPaletteDemo from "./command-palette-demo";
import CommandPaletteDense from "./command-palette-dense";
import CommandPaletteTerminal from "./command-palette-terminal";
import CommandPaletteTones from "./command-palette-tones";
import CommandPaletteViewfinder from "./command-palette-viewfinder";

const searchableExamples = [
  {
    name: "comfortable",
    Example: CommandPaletteComfortable,
    triggerName: "Open Comfortable",
    search: "files",
    expectedItem: "Search files",
    expectedId: "search",
  },
  {
    name: "default",
    Example: CommandPaletteDemo,
    triggerName: "Open Command Palette",
    search: "go to history",
    expectedItem: "Go to History",
    expectedId: "history",
  },
  {
    name: "dense",
    Example: CommandPaletteDense,
    triggerName: "Open Dense",
    search: "toggle sidebar",
    expectedItem: "Toggle sidebar",
    expectedId: "toggle-sidebar",
  },
  {
    name: "terminal",
    Example: CommandPaletteTerminal,
    triggerName: "Open Terminal",
    search: "go to history",
    expectedItem: "Go to History",
    expectedId: "history",
  },
  {
    name: "tones",
    Example: CommandPaletteTones,
    triggerName: "Open Tones",
    search: "assistant",
    expectedItem: "Ask the assistant",
    expectedId: "explain",
  },
  {
    name: "viewfinder",
    Example: CommandPaletteViewfinder,
    triggerName: "Open Viewfinder",
    search: "export pdf",
    expectedItem: "Export PDF",
    expectedId: "export",
  },
] as const;

describe("CommandPalette gallery examples", () => {
  it.each(
    searchableExamples,
  )("$name finds visible command text independently of the item's activation id", async ({
    Example,
    triggerName,
    search,
    expectedItem,
    expectedId,
  }) => {
    const user = userEvent.setup();
    const { container } = render(<Example />);

    await user.click(screen.getByRole("button", { name: triggerName }));
    const dialog = await screen.findByRole("dialog", { name: "Command palette" });
    await user.type(within(dialog).getByRole("combobox", { name: "Command search" }), search);

    const option = within(dialog).getByRole("option");
    expect(within(option).getByText(expectedItem)).toBeInTheDocument();
    expect(option).toHaveAttribute("data-value", expectedId);
    expect(await axe(container)).toHaveNoViolations();
  });
});
