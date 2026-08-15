import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { KeyboardWrapper } from "../testing/keyboard-wrapper";
import { CommandPaletteDemo } from "./command-palette";
import { ListNavigationDemo } from "./list-navigation";
import { TabBarDemo } from "./tab-bar";

function expectSelectedTabOwnsPanel(tablistName: string) {
  const tablist = screen.getByRole("tablist", { name: tablistName });
  const selectedTab = within(tablist).getByRole("tab", { selected: true });
  const tabName = selectedTab.textContent ?? "";

  // The id relationship itself is the contract, so it is cross-checked by hand.
  const panel = screen.getByRole("tabpanel", { name: tabName });
  expect(selectedTab.getAttribute("aria-controls")).toBe(panel.id);
  expect(panel.getAttribute("aria-labelledby")).toBe(selectedTab.id);
}

function expectTabControlsVisiblePanel(tabName: string, expectedContent: string) {
  const tab = screen.getByRole("tab", { name: tabName, selected: true });
  const panel = screen.getByRole("tabpanel", { name: tabName });

  expect(tab.getAttribute("aria-controls")).toBe(panel.id);
  expect(panel.textContent).toBe(expectedContent);
}

function expectTabDeselectedAndHidden(tabName: string) {
  expect(screen.getByRole("tab", { name: tabName, selected: false })).toBeTruthy();
  expect(screen.queryByRole("tabpanel", { name: tabName })).toBeNull();
}

describe("playground composite semantics", () => {
  it("renders command entries as uniquely named buttons without orphan option roles", async () => {
    const user = userEvent.setup();
    render(<CommandPaletteDemo />, { wrapper: KeyboardWrapper });

    await user.keyboard("{Control>}k{/Control}");

    const dialog = screen.getByRole("dialog", { name: "Command Palette" });
    expect(within(dialog).queryAllByRole("option")).toHaveLength(0);
    for (const name of ["Save File", "Open File", "Open Settings", "Toggle Theme"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });

  it("keeps playground sidebar buttons activatable while list navigation is open", async () => {
    const user = userEvent.setup();
    render(
      <>
        <nav aria-label="Playground demos">
          <button type="button">Tab Bar</button>
        </nav>
        <ListNavigationDemo />
      </>,
      { wrapper: KeyboardWrapper },
    );

    const sidebarButton = screen.getByRole("button", { name: "Tab Bar" });
    await user.click(sidebarButton);
    expect(document.activeElement).toBe(sidebarButton);

    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(sidebarButton);
  });

  it("links selected horizontal and vertical tabs to their labelled panels", async () => {
    const user = userEvent.setup();
    render(<TabBarDemo />);

    expectSelectedTabOwnsPanel("Account sections");
    expectSelectedTabOwnsPanel("Settings sections");

    await user.click(screen.getByRole("tab", { name: "Settings" }));
    expectTabControlsVisiblePanel(
      "Settings",
      "Configure application preferences, themes, and notification settings.",
    );
    expectTabDeselectedAndHidden("Dashboard");

    await user.click(screen.getByRole("tab", { name: "Security" }));
    expectTabControlsVisiblePanel(
      "Security",
      "Two-factor authentication, password policies, and session management.",
    );
    expectTabDeselectedAndHidden("General");
  });
});
