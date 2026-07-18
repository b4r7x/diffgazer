import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axeCore from "axe-core";
import { describe, expect, it } from "vitest";
import UseFocusZoneBasic from "./use-focus-zone/use-focus-zone-basic.js";
import UseNavigationBasic from "./use-navigation/use-navigation-basic.js";
import UseScopedNavigationBasic from "./use-scoped-navigation/use-scoped-navigation-basic.js";

async function expectNoAxeViolations(container: Element) {
  const result = await axeCore.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  expect(result.violations).toEqual([]);
}

describe("public listbox examples", () => {
  it("names both focus-zone panes and passes Axe", async () => {
    const { container } = render(<UseFocusZoneBasic />);

    expect(screen.getByRole("listbox", { name: "Sidebar" })).toBeTruthy();
    expect(screen.getByRole("listbox", { name: "Main" })).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it("keeps the navigation demo named and passes Axe", async () => {
    const { container } = render(<UseNavigationBasic />);

    expect(screen.getByRole("listbox", { name: "Fruits" })).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it("names the opened scoped-navigation palette and passes Axe", async () => {
    const user = userEvent.setup();
    const { container } = render(<UseScopedNavigationBasic />);

    await user.click(screen.getByRole("button", { name: "Open Command Palette" }));

    expect(screen.getByRole("listbox", { name: "Command Palette" })).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});
