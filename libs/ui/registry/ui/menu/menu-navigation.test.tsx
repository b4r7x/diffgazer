import { testNavigationBehavior } from "@diffgazer/keys/testing/navigation-behavior";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { Menu } from "./index";

function getMenuItem(name: string | RegExp) {
  return screen.getByRole("menuitem", { name });
}

describe("Menu typeahead", () => {
  function renderTypeaheadMenu() {
    return render(
      <Menu aria-label="Test menu">
        <Menu.Item id="alpha">Alpha</Menu.Item>
        <Menu.Item id="beta">Beta</Menu.Item>
        <Menu.Item id="charlie">Charlie</Menu.Item>
        <Menu.Item id="cherry">Cherry</Menu.Item>
      </Menu>,
    );
  }

  it("highlights item matching typed character", async () => {
    const user = userEvent.setup();
    const { container } = renderTypeaheadMenu();
    const menu = screen.getByRole("menu");
    await user.click(menu);
    await user.keyboard("b");
    const betaItem = getMenuItem("Beta");
    expect(menu).toHaveAttribute("aria-activedescendant", betaItem.id);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("accumulates characters for multi-char typeahead", async () => {
    const user = userEvent.setup();
    renderTypeaheadMenu();
    const menu = screen.getByRole("menu");
    await user.click(menu);
    await user.keyboard("ch");
    const charlieItem = getMenuItem("Charlie");
    expect(menu).toHaveAttribute("aria-activedescendant", charlieItem.id);
  });

  it("disambiguates items sharing a prefix with longer input", async () => {
    const user = userEvent.setup();
    renderTypeaheadMenu();
    const menu = screen.getByRole("menu");
    await user.click(menu);
    await user.keyboard("che");
    const cherryItem = getMenuItem("Cherry");
    expect(menu).toHaveAttribute("aria-activedescendant", cherryItem.id);
  });

  it.each([
    ["hidden", { hidden: true }],
    ["inert", { inert: true }],
    ["aria-hidden", { "aria-hidden": true }],
    ["display none", { style: { display: "none" } }],
    ["visibility hidden", { style: { visibility: "hidden" } }],
    ["visibility collapse", { style: { visibility: "collapse" } }],
    ["content visibility hidden", { style: { contentVisibility: "hidden" } }],
  ] as const)("ignores %s descendant text during typeahead", async (_case, hiddenProps) => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Menu aria-label="Test menu" onSelect={onSelect}>
        <Menu.Item id="alpha">
          Alpha
          <span {...hiddenProps}>Zulu</span>
        </Menu.Item>
        <Menu.Item id="zulu">Zulu visible</Menu.Item>
      </Menu>,
    );

    const menu = screen.getByRole("menu");
    menu.focus();
    await user.keyboard("z{Enter}");

    expect(menu).toHaveAttribute("aria-activedescendant", getMenuItem("Zulu visible").id);
    expect(onSelect).toHaveBeenCalledWith("zulu");
  });

  it.each([
    ["hidden", { hidden: true }],
    ["inert", { inert: true }],
    ["aria-hidden", { "aria-hidden": true }],
  ] as const)("removes a dynamically %s item from metadata, typeahead, and the active descendant", async (_attribute, skippedProps) => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { rerender } = render(
      <Menu aria-label="Test menu" defaultHighlighted="hidden-beta" onSelect={onSelect}>
        <Menu.Item id="hidden-beta">Beta hidden</Menu.Item>
        <Menu.Item id="visible-beta">Beta visible</Menu.Item>
        <Menu.Item id="disabled" disabled>
          Disabled
        </Menu.Item>
      </Menu>,
    );
    const menu = screen.getByRole("menu");
    const hiddenItem = getMenuItem("Beta hidden");
    expect(menu).toHaveAttribute("aria-activedescendant", hiddenItem.id);

    rerender(
      <Menu aria-label="Test menu" defaultHighlighted="hidden-beta" onSelect={onSelect}>
        <Menu.Item id="hidden-beta" {...skippedProps}>
          Beta hidden
        </Menu.Item>
        <Menu.Item id="visible-beta">Beta visible</Menu.Item>
        <Menu.Item id="disabled" disabled>
          Disabled
        </Menu.Item>
      </Menu>,
    );

    await waitFor(() => expect(menu).not.toHaveAttribute("aria-activedescendant", hiddenItem.id));
    menu.focus();
    await user.keyboard("b");
    expect(menu).toHaveAttribute("aria-activedescendant", getMenuItem("Beta visible").id);

    await user.keyboard("{ArrowDown}");
    const disabledItem = getMenuItem("Disabled");
    expect(menu).toHaveAttribute("aria-activedescendant", disabledItem.id);
    await user.keyboard("{Enter}");
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("Menu keyboard navigation", () => {
  testNavigationBehavior({
    setup: () => {
      const rendered = render(
        <Menu aria-label="Test menu" defaultHighlighted="one">
          <Menu.Item id="one">One</Menu.Item>
          <Menu.Item id="two">Two</Menu.Item>
          <Menu.Item id="three">Three</Menu.Item>
        </Menu>,
      );
      screen.getByRole("menu").focus();
      return rendered;
    },
    items: ["one", "two", "three"],
    initialActive: 0,
    cases: [
      { key: "{ArrowDown}", expectedActiveIndex: 1, label: "ArrowDown" },
      { key: "{ArrowDown}{ArrowDown}", expectedActiveIndex: 2, label: "ArrowDown twice" },
      {
        key: "{ArrowDown}{ArrowDown}{ArrowDown}",
        expectedActiveIndex: 0,
        label: "ArrowDown wraps",
      },
      { key: "{ArrowUp}", expectedActiveIndex: 2, label: "ArrowUp wraps to end" },
      { key: "{End}", expectedActiveIndex: 2, label: "End jumps to last" },
      { key: "{Home}", expectedActiveIndex: 0, label: "Home stays at first" },
      {
        key: "{ArrowDown}{ArrowUp}",
        expectedActiveIndex: 0,
        label: "ArrowUp returns from second",
      },
    ],
  });
});
