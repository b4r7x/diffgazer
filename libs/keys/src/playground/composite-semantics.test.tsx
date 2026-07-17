import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CommandPaletteDemo } from "../../examples/playground/src/demos/command-palette";
import { TabBarDemo } from "../../examples/playground/src/demos/tab-bar";
import { KeyboardWrapper } from "../testing/test-utils.js";

vi.mock("@diffgazer/keys", () => import("../index.js"));

function expectSelectedTabOwnsPanel(tablistName: string) {
  const tablist = screen.getByRole("tablist", { name: tablistName });
  const selectedTab = tablist.querySelector('[role="tab"][aria-selected="true"]');
  if (!(selectedTab instanceof HTMLElement)) throw new Error("expected a selected tab");

  const panelId = selectedTab.getAttribute("aria-controls");
  if (!panelId) throw new Error("expected the selected tab to control a panel");
  const panel = document.getElementById(panelId);
  if (!(panel instanceof HTMLElement)) throw new Error("expected the controlled panel to exist");

  expect(panel.getAttribute("role")).toBe("tabpanel");
  expect(panel.getAttribute("aria-labelledby")).toBe(selectedTab.id);
  expect(panel.hidden).toBe(false);
}

describe("playground composite semantics", () => {
  it("renders command entries as uniquely named buttons without orphan option roles", async () => {
    const user = userEvent.setup();
    render(<CommandPaletteDemo />, { wrapper: KeyboardWrapper });

    await user.keyboard("{Control>}k{/Control}");

    const dialog = screen.getByRole("dialog", { name: "Command Palette" });
    expect(dialog.querySelectorAll('[role="option"]')).toHaveLength(0);
    for (const name of ["Save File", "Open File", "Open Settings", "Toggle Theme"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });

  it("links selected horizontal and vertical tabs to their labelled panels", async () => {
    const user = userEvent.setup();
    render(<TabBarDemo />);

    expectSelectedTabOwnsPanel("Account sections");
    expectSelectedTabOwnsPanel("Settings sections");

    await user.click(screen.getByRole("tab", { name: "Settings" }));
    await user.click(screen.getByRole("tab", { name: "Security" }));

    expectSelectedTabOwnsPanel("Account sections");
    expectSelectedTabOwnsPanel("Settings sections");
  });
});
