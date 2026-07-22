import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { requireAttribute } from "../../testing/assertions";
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
  function expectServerActiveDescendant(markup: string): string {
    const activeDescendant = markup.match(/aria-activedescendant="([^"]+)"/)?.[1];
    expect(activeDescendant).toBeDefined();
    expect(markup).toContain(`id="${activeDescendant}"`);
    return activeDescendant ?? "";
  }

  it("renders a selected direct radio as the active descendant on the server", () => {
    const markup = renderToString(
      <Menu aria-label="Sort" defaultSelectedId="date">
        <Menu.ItemRadio id="name">Name</Menu.ItemRadio>
        <Menu.ItemRadio id="date">Date</Menu.ItemRadio>
      </Menu>,
    );

    expect(expectServerActiveDescendant(markup)).toContain("-date");
  });

  it("renders a highlighted direct checkbox as the active descendant on the server", () => {
    const markup = renderToString(
      <Menu aria-label="View" defaultHighlighted="wrap">
        <Menu.ItemCheckbox id="wrap">Word wrap</Menu.ItemCheckbox>
      </Menu>,
    );

    expect(expectServerActiveDescendant(markup)).toContain("-wrap");
  });

  it("keeps a highlighted disabled menu item discoverable on the server", () => {
    const markup = renderToString(
      <Menu aria-label="Actions" defaultHighlighted="disabled">
        <Menu.Item id="disabled" disabled>
          Disabled
        </Menu.Item>
      </Menu>,
    );

    expect(expectServerActiveDescendant(markup)).toContain("-disabled");
  });

  it("omits hidden, wrapper-rendered, and absent active descendants on the server", () => {
    function WrappedItem() {
      return <Menu.Item id="wrapped">Wrapped</Menu.Item>;
    }

    const hidden = renderToString(
      <Menu aria-label="Hidden" defaultHighlighted="hidden">
        <Menu.Item id="hidden" hidden>
          Hidden
        </Menu.Item>
      </Menu>,
    );
    const wrapped = renderToString(
      <Menu aria-label="Wrapped" defaultHighlighted="wrapped">
        <WrappedItem />
      </Menu>,
    );
    const noSelection = renderToString(
      <Menu aria-label="Idle">
        <Menu.Item id="idle">Idle</Menu.Item>
      </Menu>,
    );

    expect(hidden).not.toContain("aria-activedescendant");
    expect(wrapped).not.toContain("aria-activedescendant");
    expect(noSelection).not.toContain("aria-activedescendant");
  });

  it("uses live registration for a wrapper-rendered item after mount", async () => {
    function WrappedItem() {
      return <Menu.Item id="wrapped">Wrapped</Menu.Item>;
    }

    render(
      <Menu aria-label="Wrapped" defaultHighlighted="wrapped">
        <WrappedItem />
      </Menu>,
    );

    await waitFor(() =>
      expect(screen.getByRole("menu", { name: "Wrapped" })).toHaveAttribute(
        "aria-activedescendant",
        expect.stringContaining("-wrapped"),
      ),
    );
  });

  it.each([
    [
      "item",
      (onClick: React.MouseEventHandler<HTMLDivElement>) => (
        <Menu.Item id="item" onClick={onClick}>
          Item
        </Menu.Item>
      ),
    ],
    [
      "checkbox",
      (onClick: React.MouseEventHandler<HTMLDivElement>) => (
        <Menu.ItemCheckbox id="checkbox" onClick={onClick}>
          Checkbox
        </Menu.ItemCheckbox>
      ),
    ],
    [
      "radio",
      (onClick: React.MouseEventHandler<HTMLDivElement>) => (
        <Menu.ItemRadio id="radio" onClick={onClick}>
          Radio
        </Menu.ItemRadio>
      ),
    ],
  ])("lets consumer click prevention cancel %s activation", async (_variant, renderItem) => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClick = vi.fn<React.MouseEventHandler<HTMLDivElement>>((event) => {
      event.preventDefault();
    });

    render(
      <Menu aria-label="Prevented menu" onSelect={onSelect}>
        {renderItem(onClick)}
      </Menu>,
    );

    await user.click(screen.getByText(/^(Item|Checkbox|Radio)$/));

    expect(onClick).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });

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
