import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axeCore from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import UseFocusZoneBasic from "./use-focus-zone/use-focus-zone-basic.js";
import UseNavigationBasic from "./use-navigation/use-navigation-basic.js";
import UseScopedNavigationBasic from "./use-scoped-navigation/use-scoped-navigation-basic.js";

async function expectNoAxeViolations(container: Element) {
  const result = await axeCore.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  expect(result.violations).toEqual([]);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("public listbox examples", () => {
  it("moves the active/selected pane from Sidebar to Main and passes Axe", async () => {
    const user = userEvent.setup();
    const { container } = render(<UseFocusZoneBasic />);

    expect(screen.getByRole("listbox", { name: "Sidebar" })).toBeTruthy();
    expect(screen.getByRole("listbox", { name: "Main" })).toBeTruthy();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: "Dashboard" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByRole("option", { name: "Item A" }).getAttribute("aria-selected")).toBe(
      "false",
    );

    await user.keyboard("{ArrowRight}");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: "Item A" }).getAttribute("aria-selected")).toBe(
      "true",
    );

    await expectNoAxeViolations(container);
  });

  it("focuses Fruits, moves aria-activedescendant on ArrowDown, and selects on Enter, passing Axe", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { container } = render(<UseNavigationBasic />);

    const listbox = screen.getByRole("listbox", { name: "Fruits" });
    await user.click(listbox);
    expect(document.activeElement).toBe(listbox);
    expect(listbox.getAttribute("aria-activedescendant")).toBeNull();

    await user.keyboard("{ArrowDown}");
    expect(listbox.getAttribute("aria-activedescendant")).toBe("fruit-apple");

    await user.keyboard("{Enter}");
    expect(alertSpy).toHaveBeenCalledWith("Selected: Apple");

    await expectNoAxeViolations(container);
  });

  it("opens the command palette, navigates with ArrowDown, and Enter executes and closes it, passing Axe", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { container } = render(<UseScopedNavigationBasic />);

    await user.click(screen.getByRole("button", { name: "Open Command Palette" }));

    expect(screen.getByRole("listbox", { name: "Command Palette" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "New File" }).getAttribute("aria-selected")).toBe(
      "false",
    );

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: "New File" }).getAttribute("aria-selected")).toBe(
      "true",
    );

    await user.keyboard("{Enter}");
    expect(alertSpy).toHaveBeenCalledWith("Executed: New File");
    expect(screen.queryByRole("listbox", { name: "Command Palette" })).toBeNull();

    await expectNoAxeViolations(container);
  });
});
