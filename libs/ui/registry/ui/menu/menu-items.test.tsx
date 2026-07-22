import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { Menu, type MenuProps } from "./index";

type MenuRenderProps = Partial<MenuProps> & Partial<Record<`data-${string}`, string>>;

function getMenuItem(name: string | RegExp) {
  return screen.getByRole("menuitem", { name });
}

function getMenuItemRadio(name: string | RegExp) {
  return screen.getByRole("menuitemradio", { name });
}

describe("MenuItem hotkey prop", () => {
  it("keeps an unbound hotkey decorative for assistive technology", async () => {
    const { container } = render(
      <Menu aria-label="Test menu">
        <Menu.Item id="one" hotkey="N">
          New File
        </Menu.Item>
      </Menu>,
    );
    const item = getMenuItem("New File");
    expect(item).not.toHaveAttribute("aria-keyshortcuts");
    expect(item).toHaveAccessibleName("New File");
    expect(screen.getByText("[N]")).toHaveAttribute("aria-hidden", "true");
    expect(await axe(container)).toHaveNoViolations();
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

  it("keeps a disabled highlighted checkbox discoverable without toggling it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSelect = vi.fn();
    render(
      <Menu aria-label="Options" highlighted="disabled-opt" onSelect={onSelect}>
        <Menu.ItemCheckbox id="disabled-opt" disabled defaultChecked onChange={onChange}>
          Disabled
        </Menu.ItemCheckbox>
      </Menu>,
    );
    const menu = screen.getByRole("menu");
    menu.focus();

    const item = screen.getByRole("menuitemcheckbox", { name: "Disabled" });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveAttribute("aria-checked", "true");
    expect(item).toHaveAttribute("data-highlighted");

    await user.keyboard("{Enter}");
    expect(item).toHaveAttribute("aria-checked", "true");

    await user.click(item);
    expect(item).toHaveAttribute("aria-checked", "true");
    expect(onChange).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
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
        <Menu.ItemRadio id="name">Name</Menu.ItemRadio>
        <Menu.ItemRadio id="date">Date</Menu.ItemRadio>
        <Menu.ItemRadio id="size" disabled>
          Size
        </Menu.ItemRadio>
      </Menu>,
    );
  }

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
        <Menu.ItemRadio id="name">Name</Menu.ItemRadio>
        <Menu.ItemRadio id="date">Date</Menu.ItemRadio>
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
        <Menu.ItemRadio id="name">Name</Menu.ItemRadio>
        <Menu.ItemRadio id="date">Date</Menu.ItemRadio>
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
        <Menu.ItemRadio id="name">Name</Menu.ItemRadio>
        <Menu.ItemRadio id="date">Date</Menu.ItemRadio>
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
