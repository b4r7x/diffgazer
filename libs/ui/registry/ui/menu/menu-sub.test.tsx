import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { requireValue } from "../../testing/assertions";
import { Menu, type MenuProps } from "./index";

type MenuRenderProps = Partial<MenuProps> & Partial<Record<`data-${string}`, string>>;

function getMenuItem(name: string | RegExp) {
  return screen.getByRole("menuitem", { name });
}

it("keeps a disabled highlighted SubTrigger discoverable without enabled styling or activation", async () => {
  const user = userEvent.setup();
  const onOpenChange = vi.fn();
  const onSelect = vi.fn();
  const { container } = render(
    <Menu aria-label="Test menu" highlighted="more" onSelect={onSelect}>
      <Menu.Sub open={false} onOpenChange={onOpenChange}>
        <Menu.SubTrigger id="more" disabled>
          More
        </Menu.SubTrigger>
        <Menu.SubContent>
          <Menu.Item id="details">Details</Menu.Item>
        </Menu.SubContent>
      </Menu.Sub>
    </Menu>,
  );
  const menu = screen.getByRole("menu");
  const trigger = screen.getByRole("menuitem", { name: "More" });

  expect(menu).toHaveAttribute("aria-activedescendant", trigger.id);
  expect(trigger).toHaveAttribute("aria-disabled", "true");
  expect(trigger).toHaveAttribute("data-highlighted");

  menu.focus();
  await user.keyboard("{Enter}{ArrowRight}");
  await user.click(trigger);

  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(onSelect).not.toHaveBeenCalled();
  expect(await axe(container)).toHaveNoViolations();
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

  it("ArrowRight on a submenu leaf is a local no-op and keeps its parent open", async () => {
    const user = userEvent.setup();
    renderSubmenu();
    const menu = screen.getByRole("menu");
    menu.focus();

    await user.keyboard("{ArrowDown}{ArrowRight}");
    const submenu = await screen.findByRole("menu", { name: "Edit" });
    await waitFor(() => expect(submenu).toHaveFocus());

    await user.keyboard("{ArrowRight}");

    expect(getMenuItem("Edit")).toHaveAttribute("aria-expanded", "true");
    expect(submenu).toBeVisible();
    expect(submenu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-undo"));
  });

  it("ArrowRight opens a nested submenu without toggling its ancestor trigger", async () => {
    const user = userEvent.setup();
    render(
      <Menu aria-label="Root menu" defaultHighlighted="edit">
        <Menu.Sub>
          <Menu.SubTrigger id="edit">Edit</Menu.SubTrigger>
          <Menu.SubContent>
            <Menu.Item id="undo">Undo</Menu.Item>
            <Menu.Sub>
              <Menu.SubTrigger id="format">Format</Menu.SubTrigger>
              <Menu.SubContent>
                <Menu.Item id="bold">Bold</Menu.Item>
              </Menu.SubContent>
            </Menu.Sub>
          </Menu.SubContent>
        </Menu.Sub>
      </Menu>,
    );
    const rootMenu = screen.getByRole("menu", { name: "Root menu" });
    rootMenu.focus();

    await user.keyboard("{ArrowRight}");
    const editMenu = await screen.findByRole("menu", { name: "Edit" });
    await waitFor(() => expect(editMenu).toHaveFocus());
    await user.keyboard("{ArrowDown}{ArrowRight}");

    const formatMenu = await screen.findByRole("menu", { name: "Format" });
    expect(getMenuItem("Edit")).toHaveAttribute("aria-expanded", "true");
    expect(getMenuItem("Format")).toHaveAttribute("aria-expanded", "true");
    expect(editMenu).toBeVisible();
    expect(formatMenu).toBeVisible();
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

  it.each([
    "click",
    "Enter",
  ] as const)("notifies the root onSelect when a submenu item activates via %s", async (activation) => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderSubmenu({ onSelect });
    const menu = screen.getByRole("menu");
    menu.focus();

    await user.keyboard("{ArrowDown}{ArrowRight}");
    const submenu = await waitFor(() => {
      const found = screen.getAllByRole("menu").find((candidate) => candidate !== menu);
      if (!found) throw new Error("submenu not open");
      return found;
    });
    const undo = screen.getByRole("menuitem", { name: "Undo" });
    expect(onSelect).not.toHaveBeenCalled();

    if (activation === "click") {
      await user.click(undo);
    } else {
      submenu.focus();
      await waitFor(() => {
        expect(submenu).toHaveAttribute("aria-activedescendant", expect.stringContaining("-undo"));
      });
      await user.keyboard("{Enter}");
    }

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith("undo");
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
        <Menu.ItemRadio id="name">Name</Menu.ItemRadio>
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
    expect(editTrigger).toHaveAttribute("aria-haspopup", "menu");
    expect(viewTrigger).toHaveAttribute("aria-haspopup", "menu");

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
