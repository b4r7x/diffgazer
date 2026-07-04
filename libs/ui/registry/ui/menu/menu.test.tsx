import { testNavigationBehavior } from "@diffgazer/keys/testing/navigation-behavior";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { requireAttribute, requireValue } from "../../testing/assertions";
import { Menu, type MenuItemProps, MenuLabel, type MenuProps } from "./index";

type MenuRenderProps = Partial<MenuProps> & Partial<Record<`data-${string}`, string>>;

function renderMenu(props: MenuRenderProps = {}) {
  return render(
    <Menu aria-label="Test menu" {...props}>
      <Menu.Item id="one">One</Menu.Item>
      <Menu.Item id="two">Two</Menu.Item>
      <Menu.Item id="three" disabled>
        Three
      </Menu.Item>
    </Menu>,
  );
}

function getMenuItem(name: string | RegExp) {
  return screen.getByRole("menuitem", { name });
}

function getMenuItemRadio(name: string | RegExp) {
  return screen.getByRole("menuitemradio", { name });
}

describe("Menu", () => {
  it("supports direct namespaced items with custom item UI", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Menu aria-label="Test menu" onSelect={onSelect}>
        <Menu.Item id="one">
          <span>One</span>
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item id="two" value="ready">
          <span>Two</span>
        </Menu.Item>
      </Menu>,
    );

    await user.click(getMenuItem("Two"));

    expect(onSelect).toHaveBeenCalledWith("two");
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("keeps aria-activedescendant in sync for items rendered by a consumer wrapper", async () => {
    const user = userEvent.setup();
    function WrappedItem({ id, label }: { id: string; label: string }) {
      return <Menu.Item id={id}>{label}</Menu.Item>;
    }

    render(
      <Menu aria-label="Test menu" defaultHighlighted="one">
        <WrappedItem id="one" label="One" />
        <WrappedItem id="two" label="Two" />
      </Menu>,
    );

    const menu = screen.getByRole("menu");
    menu.focus();
    // Without registration the static walk cannot see WrappedItem, so the second
    // item would never become the active descendant.
    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", getMenuItem("Two").id);
  });

  it("passes native root props and composes key handling with menu navigation", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onClick = vi.fn();
    const onKeyDown = vi.fn();

    renderMenu({
      ref,
      id: "menu-root",
      "data-state": "ready",
      "aria-describedby": "menu-help",
      style: { maxWidth: "12px" },
      defaultHighlighted: "one",
      onClick,
      onKeyDown,
    });

    const menu = screen.getByRole("menu");
    await user.click(menu);
    await user.keyboard("{ArrowDown}");

    expect(menu).toHaveAttribute("id", "menu-root");
    expect(menu).toHaveAttribute("data-state", "ready");
    expect(menu).toHaveAttribute("aria-describedby", "menu-help");
    expect(menu).toHaveStyle({ maxWidth: "12px" });
    expect(menu).toHaveAttribute("tabindex", "0");
    expect(onClick).toHaveBeenCalled();
    expect(onKeyDown).toHaveBeenCalled();
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-two"));
    expect(ref.current).toBe(menu);
  });

  it("fires onSelect when an item is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderMenu({ onSelect });
    await user.click(getMenuItem("One"));
    expect(onSelect).toHaveBeenCalledWith("one");
  });

  it("does not fire onSelect for disabled items and marks them aria-disabled", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderMenu({ onSelect });
    const disabledItem = getMenuItem("Three");
    expect(disabledItem).toHaveAttribute("aria-disabled", "true");
    await user.click(disabledItem);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not move keyboard highlight on mouse hover", async () => {
    const user = userEvent.setup();
    renderMenu({ defaultHighlighted: "one" });
    const menu = screen.getByRole("menu");
    const oneItem = getMenuItem("One");
    const twoItem = getMenuItem("Two");

    expect(menu).toHaveAttribute("aria-activedescendant", oneItem.id);
    await user.hover(twoItem);
    expect(menu).toHaveAttribute("aria-activedescendant", oneItem.id);
  });

  it("marks selected items with data-selected", () => {
    renderMenu({ defaultSelectedId: "two" });
    const oneItem = getMenuItemRadio("One");
    const twoItem = getMenuItemRadio("Two");

    expect(twoItem).toHaveAttribute("data-selected");
    expect(twoItem).toHaveAttribute("aria-checked", "true");
    expect(oneItem).not.toHaveAttribute("data-selected");
  });

  it("marks the keyboard-highlighted item with data-highlighted", async () => {
    const user = userEvent.setup();
    renderMenu({ defaultHighlighted: "one" });
    const menu = screen.getByRole("menu");
    const oneItem = getMenuItem("One");
    const twoItem = getMenuItem("Two");

    menu.focus();
    await user.keyboard("{Enter}{ArrowDown}");

    expect(oneItem).not.toHaveAttribute("data-highlighted");
    expect(twoItem).toHaveAttribute("data-highlighted");
    expect(menu).toHaveAttribute("aria-activedescendant", twoItem.id);
  });

  it("marks selected detail items and renders their values", () => {
    const { rerender } = render(
      <Menu aria-label="Detail menu" variant="detail" defaultSelectedId="provider">
        <Menu.Item id="provider" value="ready" valueVariant="success-badge">
          Provider
        </Menu.Item>
        <Menu.Item id="delete" variant="danger" value="armed">
          Delete
        </Menu.Item>
      </Menu>,
    );

    const providerItem = getMenuItemRadio(/provider/i);
    expect(providerItem).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("ready")).toBeInTheDocument();

    rerender(
      <Menu aria-label="Detail menu" variant="detail" highlighted="delete">
        <Menu.Item id="provider" value="ready" valueVariant="success-badge">
          Provider
        </Menu.Item>
        <Menu.Item id="delete" variant="danger" value="armed">
          Delete
        </Menu.Item>
      </Menu>,
    );
    expect(screen.getByText("armed")).toBeInTheDocument();
  });

  it("selects defaultSelectedId initially", () => {
    renderMenu({ defaultSelectedId: "two" });
    const item = getMenuItemRadio("Two");
    expect(item).toHaveAttribute("aria-checked", "true");
  });

  it("fires onSelect in controlled mode without internal state change", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { rerender } = render(
      <Menu aria-label="Test menu" selectedId="one" onSelect={onSelect}>
        <Menu.Item id="one">One</Menu.Item>
        <Menu.Item id="two">Two</Menu.Item>
      </Menu>,
    );
    await user.click(getMenuItemRadio("Two"));
    expect(onSelect).toHaveBeenCalledWith("two");
    expect(getMenuItemRadio("One")).toHaveAttribute("aria-checked", "true");

    rerender(
      <Menu aria-label="Test menu" selectedId="two" onSelect={onSelect}>
        <Menu.Item id="one">One</Menu.Item>
        <Menu.Item id="two">Two</Menu.Item>
      </Menu>,
    );
    expect(getMenuItemRadio("Two")).toHaveAttribute("aria-checked", "true");
  });

  it("has no a11y violations", async () => {
    const { container } = renderMenu();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("moves highlight with ArrowDown and ArrowUp", async () => {
    const user = userEvent.setup();
    renderMenu({ defaultHighlighted: "one" });
    const menu = screen.getByRole("menu");
    menu.focus();
    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-two"));
    await user.keyboard("{ArrowUp}");
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-one"));
  });

  it("activates highlighted item with Enter", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderMenu({ defaultHighlighted: "one", onSelect });
    const listbox = screen.getByRole("menu");
    listbox.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("one");
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderMenu({ onClose, defaultHighlighted: "one" });
    const menu = screen.getByRole("menu");
    menu.focus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose on Tab and lets focus leave the menu", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <>
        <Menu
          aria-label="Test menu"
          onClose={onClose}
          onKeyDown={onKeyDown}
          defaultHighlighted="one"
        >
          <Menu.Item id="one">One</Menu.Item>
          <Menu.Item id="two">Two</Menu.Item>
          <Menu.Item id="three" disabled>
            Three
          </Menu.Item>
        </Menu>
        <button type="button">After</button>
      </>,
    );
    const menu = screen.getByRole("menu");
    menu.focus();

    await user.keyboard("{Tab}");

    expect(onClose).toHaveBeenCalled();
    expect(onKeyDown).toHaveBeenCalled();
    expect(menu).not.toHaveFocus();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("focuses the container on mount when autoFocus is true", async () => {
    renderMenu({ autoFocus: true, defaultHighlighted: "one" });
    const menu = screen.getByRole("menu");
    await waitFor(() => {
      expect(menu).toHaveFocus();
    });
  });

  it("autoFocus initializes the first menu item, including disabled items", async () => {
    render(
      <Menu aria-label="Test menu" autoFocus>
        <Menu.Item id="one" disabled>
          One
        </Menu.Item>
        <Menu.Item id="two">Two</Menu.Item>
      </Menu>,
    );
    const menu = screen.getByRole("menu");
    const oneItem = getMenuItem("One");

    await waitFor(() => {
      expect(menu).toHaveAttribute("aria-activedescendant", oneItem.id);
    });
  });

  it("autoFocus preserves an empty string highlighted id", async () => {
    render(
      <Menu aria-label="Test menu" autoFocus defaultHighlighted="">
        <Menu.Item id="one">One</Menu.Item>
        <Menu.Item id="">Empty id</Menu.Item>
      </Menu>,
    );

    const menu = screen.getByRole("menu");
    const emptyItem = getMenuItem("Empty id");

    await waitFor(() => {
      expect(menu).toHaveFocus();
      expect(menu).toHaveAttribute("aria-activedescendant", emptyItem.id);
    });
  });

  it("uses encoded item ids for active descendant references", () => {
    const id = "release notes/v1.2?";
    render(
      <Menu aria-label="Test menu" defaultHighlighted={id}>
        <Menu.Item id={id}>Release</Menu.Item>
        <Menu.Item id="other">Other</Menu.Item>
      </Menu>,
    );

    const menu = screen.getByRole("menu");
    const item = getMenuItem("Release");

    expect(item.id).toContain(encodeURIComponent(id));
    expect(menu).toHaveAttribute("aria-activedescendant", item.id);
    expect(document.getElementById(requireAttribute(menu, "aria-activedescendant"))).toBe(item);
  });

  it("treats an empty string item id as a valid active descendant value", () => {
    render(
      <Menu aria-label="Test menu" defaultHighlighted="">
        <Menu.Item id="">Empty id</Menu.Item>
        <Menu.Item id="other">Other</Menu.Item>
      </Menu>,
    );

    const menu = screen.getByRole("menu");
    const item = getMenuItem("Empty id");

    expect(menu).toHaveAttribute("aria-activedescendant", item.id);
    expect(document.getElementById(item.id)).toBe(item);
  });

  it("renders falsy detail item values that are explicit React nodes", () => {
    render(
      <Menu aria-label="Test menu" variant="detail">
        <Menu.Item id="zero" value={0}>
          Zero
        </Menu.Item>
        <Menu.Item id="empty" value="">
          Empty
        </Menu.Item>
      </Menu>,
    );

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(getMenuItem("Empty")).toHaveTextContent("Empty");
  });

  it("renders a divider as a separator", () => {
    render(
      <Menu aria-label="Test menu">
        <Menu.Item id="one">One</Menu.Item>
        <Menu.Divider />
        <Menu.Item id="two">Two</Menu.Item>
      </Menu>,
    );
    expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("does not render disabled item as selected when supplied via controlled selectedId", () => {
    render(
      <Menu aria-label="Test menu" selectedId="two">
        <Menu.Item id="one">One</Menu.Item>
        <Menu.Item id="two" disabled>
          Two
        </Menu.Item>
      </Menu>,
    );
    const disabledItem = getMenuItemRadio("Two");
    expect(disabledItem).toHaveAttribute("aria-disabled", "true");
    expect(disabledItem).not.toHaveAttribute("aria-checked", "true");
    expect(disabledItem).not.toHaveAttribute("data-selected");
  });

  it("disabled highlighted menu item is the active descendant with focus indication but not selected", () => {
    // APG menu pattern: disabled menu items remain focusable (active descendant)
    // but should not appear visually active or be announced as selected.
    render(
      <Menu aria-label="Test menu" highlighted="two">
        <Menu.Item id="one">One</Menu.Item>
        <Menu.Item id="two" disabled>
          Two
        </Menu.Item>
      </Menu>,
    );
    const menu = screen.getByRole("menu");
    const disabledItem = getMenuItem("Two");

    expect(menu).toHaveAttribute("aria-activedescendant", disabledItem.id);
    expect(disabledItem).not.toHaveAttribute("data-selected");
    expect(disabledItem).toHaveAttribute("data-highlighted");
    expect(disabledItem).not.toHaveAttribute("aria-checked", "true");
  });

  it("APG: ArrowDown moves through disabled menu items but Enter does not activate them", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Menu aria-label="Test menu" defaultHighlighted="one" onSelect={onSelect}>
        <Menu.Item id="one">One</Menu.Item>
        <Menu.Item id="two" disabled>
          Two
        </Menu.Item>
        <Menu.Item id="three">Three</Menu.Item>
      </Menu>,
    );
    const menu = screen.getByRole("menu");
    const twoItem = getMenuItem("Two");
    const threeItem = getMenuItem("Three");

    menu.focus();
    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", twoItem.id);

    await user.keyboard("{Enter}");
    expect(onSelect).not.toHaveBeenCalled();

    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", threeItem.id);

    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("three");
  });
});

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
    renderTypeaheadMenu();
    const menu = screen.getByRole("menu");
    await user.click(menu);
    await user.keyboard("b");
    const betaItem = getMenuItem("Beta");
    expect(menu).toHaveAttribute("aria-activedescendant", betaItem.id);
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
    ],
  });
});

describe("MenuItem hotkey prop", () => {
  it("exposes the hotkey to AT via aria-keyshortcuts while the glyph stays decorative", () => {
    render(
      <Menu aria-label="Test menu">
        <Menu.Item id="one" hotkey="N">
          New File
        </Menu.Item>
      </Menu>,
    );
    const item = getMenuItem("New File");
    expect(item).toHaveAttribute("aria-keyshortcuts", "N");
    // The bracketed glyph is decorative and does not pollute the item name.
    expect(item).toHaveAccessibleName("New File");
    expect(screen.getByText("[N]")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("MenuItem icon prop", () => {
  it("renders icon content when icon is provided", () => {
    render(
      <Menu aria-label="Test menu">
        <Menu.Item id="one" icon={<span>+</span>}>
          New File
        </Menu.Item>
      </Menu>,
    );
    expect(screen.getByText("+")).toBeInTheDocument();
    expect(getMenuItem("New File")).toBeInTheDocument();
  });

  it("does not render indicator characters when icon is provided", () => {
    render(
      <Menu aria-label="Test menu" defaultHighlighted="one">
        <Menu.Item id="one" icon={<span>+</span>}>
          New File
        </Menu.Item>
      </Menu>,
    );
    const item = getMenuItem("New File");
    expect(item).not.toHaveTextContent("▌");
    expect(item).not.toHaveTextContent(">");
  });

  it("renders indicator characters when icon is not provided", () => {
    render(
      <Menu aria-label="Test menu" defaultHighlighted="one">
        <Menu.Item id="one">One</Menu.Item>
        <Menu.Item id="two">Two</Menu.Item>
      </Menu>,
    );
    const focusedItem = getMenuItem("One");
    expect(focusedItem).toHaveTextContent("▌");
  });

  it("icon item is navigable and activatable", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Menu aria-label="Test menu" defaultHighlighted="one" onSelect={onSelect}>
        <Menu.Item id="one" icon={<span>+</span>}>
          New File
        </Menu.Item>
        <Menu.Item id="two" icon={<span>/</span>}>
          Search
        </Menu.Item>
      </Menu>,
    );
    const menu = screen.getByRole("menu");
    menu.focus();
    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-two"));
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("two");
  });

  it("renders icon in detail variant", () => {
    render(
      <Menu aria-label="Detail menu" variant="detail" defaultSelectedId="provider">
        <Menu.Item id="provider" icon={<span>*</span>} value="ready">
          Provider
        </Menu.Item>
      </Menu>,
    );
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(getMenuItemRadio(/Provider/)).toHaveAttribute("aria-checked", "true");
  });
});

describe("Menu types", () => {
  it("narrows selectedId/onSelect to the supplied literal union", () => {
    type Narrow = MenuProps<"main" | "develop">;

    expectTypeOf<Narrow["selectedId"]>().toEqualTypeOf<"main" | "develop" | null | undefined>();
    expectTypeOf<Narrow["defaultSelectedId"]>().toEqualTypeOf<
      "main" | "develop" | null | undefined
    >();
    expectTypeOf<NonNullable<Narrow["onSelect"]>>()
      .parameter(0)
      .toEqualTypeOf<"main" | "develop">();
  });

  it("rejects MenuItem ids outside the literal union", () => {
    expectTypeOf<"feature">().not.toMatchTypeOf<MenuItemProps<"main" | "develop">["id"]>();
    expectTypeOf<"main">().toMatchTypeOf<MenuItemProps<"main" | "develop">["id"]>();
  });

  it("keeps the loose default contract when no generic is supplied", () => {
    expectTypeOf<MenuProps["selectedId"]>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<MenuItemProps["id"]>().toEqualTypeOf<string>();
  });
});

describe("MenuGroup and MenuLabel", () => {
  it("renders role=group with aria-labelledby when label prop is provided", () => {
    render(
      <Menu aria-label="Test menu">
        <Menu.Group label="Section">
          <Menu.Item id="one">One</Menu.Item>
        </Menu.Group>
      </Menu>,
    );

    const group = screen.getByRole("group");
    expect(group).toHaveAttribute("aria-labelledby");
    expect(screen.getByText("Section")).toBeInTheDocument();

    const labelId = requireAttribute(group, "aria-labelledby");
    const label = document.getElementById(labelId);
    expect(label).toHaveTextContent("Section");
  });

  it("renders role=group without aria-labelledby when no label prop", () => {
    render(
      <Menu aria-label="Test menu">
        <Menu.Group>
          <Menu.Item id="one">One</Menu.Item>
        </Menu.Group>
      </Menu>,
    );

    const group = screen.getByRole("group");
    expect(group).not.toHaveAttribute("aria-labelledby");
  });

  it("renders MenuLabel as a standalone presentation element", () => {
    render(
      <Menu aria-label="Test menu">
        <MenuLabel>Custom Header</MenuLabel>
        <Menu.Item id="one">One</Menu.Item>
      </Menu>,
    );

    const label = screen.getByText("Custom Header");
    expect(label).toHaveAttribute("role", "presentation");
  });

  it("keyboard navigation passes through groups seamlessly", async () => {
    const user = userEvent.setup();
    render(
      <Menu aria-label="Test menu" defaultHighlighted="one">
        <Menu.Group label="First">
          <Menu.Item id="one">One</Menu.Item>
          <Menu.Item id="two">Two</Menu.Item>
        </Menu.Group>
        <Menu.Group label="Second">
          <Menu.Item id="three">Three</Menu.Item>
        </Menu.Group>
      </Menu>,
    );

    const menu = screen.getByRole("menu");
    menu.focus();

    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-two"));

    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-three"));
  });

  it("has no a11y violations with grouped items", async () => {
    const { container } = render(
      <Menu aria-label="Test menu">
        <Menu.Group label="Actions">
          <Menu.Item id="one">One</Menu.Item>
          <Menu.Item id="two">Two</Menu.Item>
        </Menu.Group>
        <Menu.Group label="Danger zone">
          <Menu.Item id="delete" variant="danger">
            Delete
          </Menu.Item>
        </Menu.Group>
      </Menu>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("MenuSub", () => {
  function renderSubmenu(props: MenuRenderProps = {}) {
    return render(
      <Menu aria-label="Test menu" defaultHighlighted="file" {...props}>
        <Menu.Item id="file">File</Menu.Item>
        <Menu.Sub>
          <Menu.SubTrigger id="edit">Edit</Menu.SubTrigger>
          <Menu.SubContent>
            <Menu.Item id="undo">Undo</Menu.Item>
            <Menu.Item id="redo">Redo</Menu.Item>
          </Menu.SubContent>
        </Menu.Sub>
        <Menu.Item id="quit">Quit</Menu.Item>
      </Menu>,
    );
  }

  async function waitForSubmenuFocus(name = "Edit") {
    await waitFor(() => expect(screen.getByRole("menu", { name })).toHaveFocus());
  }

  it("SubTrigger renders with aria-haspopup='menu'", () => {
    renderSubmenu();
    const trigger = getMenuItem("Edit");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
  });

  it("SubTrigger shows aria-expanded when submenu is open", async () => {
    const user = userEvent.setup();
    renderSubmenu();
    const trigger = getMenuItem("Edit");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("ArrowRight on trigger opens submenu", async () => {
    const user = userEvent.setup();
    renderSubmenu();
    const menu = screen.getByRole("menu");
    menu.focus();

    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-edit"));

    await user.keyboard("{ArrowRight}");
    const trigger = getMenuItem("Edit");
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await waitFor(() => {
      const submenus = screen.getAllByRole("menu");
      expect(submenus.length).toBeGreaterThan(1);
    });
  });

  it("Enter on trigger opens submenu", async () => {
    const user = userEvent.setup();
    renderSubmenu();
    const menu = screen.getByRole("menu");
    menu.focus();

    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-edit"));

    await user.keyboard("{Enter}");
    const trigger = getMenuItem("Edit");
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await waitFor(() => {
      const submenus = screen.getAllByRole("menu");
      expect(submenus.length).toBeGreaterThan(1);
    });
  });

  it("Space on trigger opens submenu", async () => {
    const user = userEvent.setup();
    renderSubmenu();
    const menu = screen.getByRole("menu");
    menu.focus();

    await user.keyboard("{ArrowDown}");
    await user.keyboard(" ");
    const trigger = getMenuItem("Edit");
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await waitFor(() => {
      const submenus = screen.getAllByRole("menu");
      expect(submenus.length).toBeGreaterThan(1);
    });
  });

  it("first item in submenu receives focus when opened", async () => {
    const user = userEvent.setup();
    renderSubmenu();
    const menu = screen.getByRole("menu");
    menu.focus();

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowRight}");

    await waitFor(() => {
      const submenus = screen.getAllByRole("menu");
      const submenu = submenus.find((m) => m !== menu);
      expect(submenu).toBeDefined();
      expect(submenu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-undo"));
    });
  });

  it("ArrowLeft in submenu closes it and returns focus to trigger", async () => {
    const user = userEvent.setup();
    renderSubmenu();
    const menu = screen.getByRole("menu");
    menu.focus();

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowRight}");

    await waitFor(() => {
      expect(screen.getAllByRole("menu").length).toBeGreaterThan(1);
    });

    const submenu = requireValue(
      screen.getAllByRole("menu").find((candidate) => candidate !== menu),
      "submenu",
    );
    submenu.focus();
    await user.keyboard("{ArrowLeft}");

    expect(menu).toHaveFocus();
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-edit"));
  });

  it("Escape in submenu closes it and returns focus to trigger", async () => {
    const user = userEvent.setup();
    renderSubmenu();
    const menu = screen.getByRole("menu");
    menu.focus();

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowRight}");

    await waitFor(() => {
      expect(screen.getAllByRole("menu").length).toBeGreaterThan(1);
    });

    const submenu = requireValue(
      screen.getAllByRole("menu").find((candidate) => candidate !== menu),
      "submenu",
    );
    submenu.focus();
    await user.keyboard("{Escape}");

    expect(menu).toHaveFocus();
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-edit"));
  });

  it("submenu items have keyboard navigation (ArrowUp/Down)", async () => {
    const user = userEvent.setup();
    renderSubmenu();
    const menu = screen.getByRole("menu");
    menu.focus();

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowRight}");

    await waitFor(() => {
      expect(screen.getAllByRole("menu").length).toBeGreaterThan(1);
    });

    const submenu = requireValue(
      screen.getAllByRole("menu").find((candidate) => candidate !== menu),
      "submenu",
    );
    submenu.focus();

    await waitFor(() => {
      expect(submenu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-undo"));
    });

    await user.keyboard("{ArrowDown}");
    expect(submenu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-redo"));

    await user.keyboard("{ArrowUp}");
    expect(submenu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-undo"));
  });

  it("multiple SubMenus can exist in the same parent menu", () => {
    render(
      <Menu aria-label="Test menu">
        <Menu.Sub>
          <Menu.SubTrigger id="edit">Edit</Menu.SubTrigger>
          <Menu.SubContent>
            <Menu.Item id="undo">Undo</Menu.Item>
          </Menu.SubContent>
        </Menu.Sub>
        <Menu.Sub>
          <Menu.SubTrigger id="view">View</Menu.SubTrigger>
          <Menu.SubContent>
            <Menu.Item id="zoom">Zoom</Menu.Item>
          </Menu.SubContent>
        </Menu.Sub>
      </Menu>,
    );

    const editTrigger = getMenuItem("Edit");
    const viewTrigger = getMenuItem("View");
    expect(editTrigger).toHaveAttribute("aria-haspopup", "menu");
    expect(viewTrigger).toHaveAttribute("aria-haspopup", "menu");
  });

  it("SubTrigger participates in parent menu keyboard navigation", async () => {
    const user = userEvent.setup();
    renderSubmenu();
    const menu = screen.getByRole("menu");
    menu.focus();

    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-edit"));

    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-quit"));
  });

  it("submenu items do not leak into parent keyboard navigation", async () => {
    const user = userEvent.setup();
    renderSubmenu();
    const menu = screen.getByRole("menu");
    menu.focus();

    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-edit"));

    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-quit"));

    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-file"));
  });

  it("Tab inside a portaled submenu returns focus to the parent menu", async () => {
    const user = userEvent.setup();
    renderSubmenu();
    const menu = screen.getByRole("menu");
    menu.focus();

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowRight}");

    await waitFor(() => {
      expect(screen.getAllByRole("menu").length).toBeGreaterThan(1);
    });

    const submenu = requireValue(
      screen.getAllByRole("menu").find((candidate) => candidate !== menu),
      "submenu",
    );
    submenu.focus();

    await user.keyboard("{Tab}");

    const trigger = getMenuItem("Edit");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveFocus();
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-edit"));
  });

  it("SubTrigger pins role to menuitem and never renders aria-checked in a selection menu", () => {
    render(
      <Menu aria-label="Sort" selectedId="name">
        <Menu.ItemRadio id="name" value="name">
          Name
        </Menu.ItemRadio>
        <Menu.Sub>
          <Menu.SubTrigger id="more">More</Menu.SubTrigger>
          <Menu.SubContent>
            <Menu.Item id="zoom">Zoom</Menu.Item>
          </Menu.SubContent>
        </Menu.Sub>
      </Menu>,
    );

    const trigger = screen.getByRole("menuitem", { name: "More" });
    expect(trigger).not.toHaveAttribute("aria-checked");
  });

  it("labels the submenu by its trigger via aria-labelledby", async () => {
    const user = userEvent.setup();
    renderSubmenu();
    const menu = screen.getByRole("menu");
    menu.focus();

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowRight}");

    const submenu = await waitFor(() => {
      const found = screen.getAllByRole("menu").find((candidate) => candidate !== menu);
      if (!found) throw new Error("submenu not open");
      return found;
    });

    expect(submenu).toHaveAccessibleName("Edit");
  });

  it("respects a consumer aria-label on SubContent over the trigger label", async () => {
    const user = userEvent.setup();
    render(
      <Menu aria-label="Test menu" defaultHighlighted="edit">
        <Menu.Sub>
          <Menu.SubTrigger id="edit">Edit</Menu.SubTrigger>
          <Menu.SubContent aria-label="Edit options">
            <Menu.Item id="undo">Undo</Menu.Item>
          </Menu.SubContent>
        </Menu.Sub>
      </Menu>,
    );
    const menu = screen.getByRole("menu");
    menu.focus();
    await user.keyboard("{ArrowRight}");

    const submenu = await waitFor(() => {
      const found = screen.getAllByRole("menu").find((candidate) => candidate !== menu);
      if (!found) throw new Error("submenu not open");
      return found;
    });

    expect(submenu).toHaveAccessibleName("Edit options");
  });

  it("closes an open submenu on an outside pointerdown", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Menu aria-label="Test menu" defaultHighlighted="edit">
          <Menu.Sub>
            <Menu.SubTrigger id="edit">Edit</Menu.SubTrigger>
            <Menu.SubContent>
              <Menu.Item id="undo">Undo</Menu.Item>
            </Menu.SubContent>
          </Menu.Sub>
        </Menu>
        <button type="button">Outside</button>
      </>,
    );
    const trigger = getMenuItem("Edit");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes an open submenu when the parent highlight moves off its trigger", async () => {
    const user = userEvent.setup();
    renderSubmenu();
    const menu = screen.getByRole("menu");
    menu.focus();

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowRight}");
    const edit = getMenuItem("Edit");
    await waitFor(() => expect(edit).toHaveAttribute("aria-expanded", "true"));
    await waitForSubmenuFocus();

    // Move the parent highlight off the submenu trigger.
    menu.focus();
    expect(menu).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(edit).toHaveAttribute("aria-expanded", "false"));
  });

  it("keeps only one submenu open per level (moving to a sibling closes the first)", async () => {
    const user = userEvent.setup();
    render(
      <Menu aria-label="Test menu" defaultHighlighted="edit">
        <Menu.Sub>
          <Menu.SubTrigger id="edit">Edit</Menu.SubTrigger>
          <Menu.SubContent>
            <Menu.Item id="undo">Undo</Menu.Item>
          </Menu.SubContent>
        </Menu.Sub>
        <Menu.Sub>
          <Menu.SubTrigger id="view">View</Menu.SubTrigger>
          <Menu.SubContent>
            <Menu.Item id="zoom">Zoom</Menu.Item>
          </Menu.SubContent>
        </Menu.Sub>
      </Menu>,
    );

    const menu = screen.getByRole("menu");
    const editTrigger = getMenuItem("Edit");
    const viewTrigger = getMenuItem("View");

    menu.focus();
    await user.click(editTrigger);
    expect(editTrigger).toHaveAttribute("aria-expanded", "true");
    await waitForSubmenuFocus();

    // Arrowing the parent highlight onto the sibling trigger closes the first
    // submenu (one open per level); opening the sibling keeps only it open.
    menu.focus();
    expect(menu).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(menu).toHaveAttribute("aria-activedescendant", viewTrigger.id));
    await waitFor(() => expect(editTrigger).toHaveAttribute("aria-expanded", "false"));

    await user.click(viewTrigger);
    await waitFor(() => expect(viewTrigger).toHaveAttribute("aria-expanded", "true"));
    expect(editTrigger).toHaveAttribute("aria-expanded", "false");
  });

  it("axe() accessibility audit passes", async () => {
    const { container } = renderSubmenu();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("MenuItemCheckbox", () => {
  function renderCheckboxMenu(props: MenuRenderProps = {}) {
    return render(
      <Menu aria-label="Options" {...props}>
        <Menu.ItemCheckbox id="hidden" defaultChecked>
          Show Hidden
        </Menu.ItemCheckbox>
        <Menu.ItemCheckbox id="wrap">Word Wrap</Menu.ItemCheckbox>
        <Menu.ItemCheckbox id="disabled-opt" disabled>
          Disabled Option
        </Menu.ItemCheckbox>
      </Menu>,
    );
  }

  it("renders with role=menuitemcheckbox", () => {
    renderCheckboxMenu();
    expect(screen.getByRole("menuitemcheckbox", { name: "Show Hidden" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemcheckbox", { name: "Word Wrap" })).toBeInTheDocument();
  });

  it("shows [x] when checked and [ ] when unchecked", () => {
    renderCheckboxMenu();
    const checked = screen.getByRole("menuitemcheckbox", { name: "Show Hidden" });
    const unchecked = screen.getByRole("menuitemcheckbox", { name: "Word Wrap" });
    expect(checked).toHaveTextContent("[x]");
    expect(unchecked).toHaveTextContent("[ ]");
  });

  it("toggles on Enter key", async () => {
    const user = userEvent.setup();
    renderCheckboxMenu({ defaultHighlighted: "wrap" });
    const menu = screen.getByRole("menu");
    menu.focus();

    const item = screen.getByRole("menuitemcheckbox", { name: "Word Wrap" });
    expect(item).toHaveAttribute("aria-checked", "false");

    await user.keyboard("{Enter}");
    expect(item).toHaveAttribute("aria-checked", "true");
    expect(item).toHaveTextContent("[x]");

    await user.keyboard("{Enter}");
    expect(item).toHaveAttribute("aria-checked", "false");
    expect(item).toHaveTextContent("[ ]");
  });

  it("toggles on Space key", async () => {
    const user = userEvent.setup();
    renderCheckboxMenu({ defaultHighlighted: "wrap" });
    const menu = screen.getByRole("menu");
    menu.focus();

    const item = screen.getByRole("menuitemcheckbox", { name: "Word Wrap" });
    expect(item).toHaveAttribute("aria-checked", "false");

    await user.keyboard(" ");
    expect(item).toHaveAttribute("aria-checked", "true");
  });

  it("respects controlled checked prop", () => {
    const { rerender } = render(
      <Menu aria-label="Options">
        <Menu.ItemCheckbox id="opt" checked={false}>
          Option
        </Menu.ItemCheckbox>
      </Menu>,
    );

    const item = screen.getByRole("menuitemcheckbox", { name: "Option" });
    expect(item).toHaveAttribute("aria-checked", "false");
    expect(item).toHaveTextContent("[ ]");

    rerender(
      <Menu aria-label="Options">
        <Menu.ItemCheckbox id="opt" checked={true}>
          Option
        </Menu.ItemCheckbox>
      </Menu>,
    );
    expect(item).toHaveAttribute("aria-checked", "true");
    expect(item).toHaveTextContent("[x]");
  });

  it("works with defaultChecked (uncontrolled)", async () => {
    const user = userEvent.setup();
    renderCheckboxMenu({ defaultHighlighted: "hidden" });
    const menu = screen.getByRole("menu");
    menu.focus();

    const item = screen.getByRole("menuitemcheckbox", { name: "Show Hidden" });
    expect(item).toHaveAttribute("aria-checked", "true");

    await user.keyboard("{Enter}");
    expect(item).toHaveAttribute("aria-checked", "false");
  });

  it("disabled item does not toggle", async () => {
    const user = userEvent.setup();
    render(
      <Menu aria-label="Options" defaultHighlighted="disabled-opt">
        <Menu.ItemCheckbox id="disabled-opt" disabled defaultChecked>
          Disabled
        </Menu.ItemCheckbox>
      </Menu>,
    );
    const menu = screen.getByRole("menu");
    menu.focus();

    const item = screen.getByRole("menuitemcheckbox", { name: "Disabled" });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveAttribute("aria-checked", "true");

    await user.keyboard("{Enter}");
    expect(item).toHaveAttribute("aria-checked", "true");

    await user.click(item);
    expect(item).toHaveAttribute("aria-checked", "true");
  });

  it("toggles on click", async () => {
    const user = userEvent.setup();
    renderCheckboxMenu();
    const item = screen.getByRole("menuitemcheckbox", { name: "Word Wrap" });
    expect(item).toHaveAttribute("aria-checked", "false");

    await user.click(item);
    expect(item).toHaveAttribute("aria-checked", "true");
    expect(item).toHaveTextContent("[x]");

    await user.click(item);
    expect(item).toHaveAttribute("aria-checked", "false");
  });

  it("participates in arrow-key navigation", async () => {
    const user = userEvent.setup();
    render(
      <Menu aria-label="Mixed" defaultHighlighted="action">
        <Menu.Item id="action">Action</Menu.Item>
        <Menu.ItemCheckbox id="check-opt">Toggle</Menu.ItemCheckbox>
        <Menu.Item id="another">Another</Menu.Item>
      </Menu>,
    );
    const menu = screen.getByRole("menu");
    menu.focus();

    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-check-opt"));

    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-another"));
  });

  it("calls onChange callback", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Menu aria-label="Options" defaultHighlighted="opt">
        <Menu.ItemCheckbox id="opt" onChange={onChange}>
          Option
        </Menu.ItemCheckbox>
      </Menu>,
    );
    const menu = screen.getByRole("menu");
    menu.focus();

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(true);

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("axe() audit passes", async () => {
    const { container } = renderCheckboxMenu();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("MenuItemRadio", () => {
  function renderRadioMenu(props: MenuRenderProps = {}) {
    return render(
      <Menu aria-label="Sort" selectedId="name" onSelect={vi.fn()} {...props}>
        <Menu.ItemRadio id="name" value="name">
          Name
        </Menu.ItemRadio>
        <Menu.ItemRadio id="date" value="date">
          Date
        </Menu.ItemRadio>
        <Menu.ItemRadio id="size" value="size" disabled>
          Size
        </Menu.ItemRadio>
      </Menu>,
    );
  }

  it("renders with role=menuitemradio", () => {
    renderRadioMenu();
    expect(screen.getByRole("menuitemradio", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Date" })).toBeInTheDocument();
  });

  it("shows (*) when selected and ( ) when not", () => {
    renderRadioMenu();
    const selected = screen.getByRole("menuitemradio", { name: "Name" });
    const unselected = screen.getByRole("menuitemradio", { name: "Date" });
    expect(selected).toHaveTextContent("(*)");
    expect(unselected).toHaveTextContent("( )");
  });

  it("works with Menu selectedId/onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderRadioMenu({ onSelect });
    await user.click(screen.getByRole("menuitemradio", { name: "Date" }));
    expect(onSelect).toHaveBeenCalledWith("date");
  });

  it("aria-checked reflects selection state", () => {
    const { rerender } = render(
      <Menu aria-label="Sort" selectedId="name">
        <Menu.ItemRadio id="name" value="name">
          Name
        </Menu.ItemRadio>
        <Menu.ItemRadio id="date" value="date">
          Date
        </Menu.ItemRadio>
      </Menu>,
    );

    expect(screen.getByRole("menuitemradio", { name: "Name" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: "Date" })).toHaveAttribute(
      "aria-checked",
      "false",
    );

    rerender(
      <Menu aria-label="Sort" selectedId="date">
        <Menu.ItemRadio id="name" value="name">
          Name
        </Menu.ItemRadio>
        <Menu.ItemRadio id="date" value="date">
          Date
        </Menu.ItemRadio>
      </Menu>,
    );

    expect(screen.getByRole("menuitemradio", { name: "Name" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("menuitemradio", { name: "Date" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("participates in arrow-key navigation", async () => {
    const user = userEvent.setup();
    render(
      <Menu aria-label="Mixed" selectedId="name" defaultHighlighted="action">
        <Menu.Item id="action">Action</Menu.Item>
        <Menu.ItemRadio id="name" value="name">
          Name
        </Menu.ItemRadio>
        <Menu.ItemRadio id="date" value="date">
          Date
        </Menu.ItemRadio>
      </Menu>,
    );
    const menu = screen.getByRole("menu");
    menu.focus();

    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-name"));

    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-date"));
  });

  it("disabled radio does not select", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderRadioMenu({ onSelect });
    const disabled = screen.getByRole("menuitemradio", { name: "Size" });
    expect(disabled).toHaveAttribute("aria-disabled", "true");
    await user.click(disabled);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("axe() audit passes", async () => {
    const { container } = renderRadioMenu();
    expect(await axe(container)).toHaveNoViolations();
  });
});
