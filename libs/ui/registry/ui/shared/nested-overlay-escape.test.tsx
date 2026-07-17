import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "../dialog/index";
import { Menu } from "../menu/index";
import { Popover } from "../popover/index";

describe("Nested overlay: Popover inside Dialog", () => {
  it("Escape on open popover closes only the popover, not the dialog", async () => {
    const user = userEvent.setup();
    const onDialogChange = vi.fn();
    const onPopoverChange = vi.fn();

    render(
      <Dialog defaultOpen onOpenChange={onDialogChange}>
        <Dialog.Trigger>Open Dialog</Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Test Dialog</Dialog.Title>
          </Dialog.Header>
          <Popover triggerMode="click" defaultOpen onOpenChange={onPopoverChange}>
            <Popover.Trigger>Open Popover</Popover.Trigger>
            <Popover.Content aria-label="Nested popover">
              <button type="button">Inside Popover</button>
            </Popover.Content>
          </Popover>
        </Dialog.Content>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Test Dialog" });
    const popoverTrigger = screen.getByRole("button", { name: "Open Popover" });
    const popoverId = popoverTrigger.getAttribute("aria-controls");
    if (!popoverId) throw new Error("Expected popover trigger to control mounted content");

    const popover = document.getElementById(popoverId);
    expect(dialog).toHaveAttribute("data-state", "open");
    expect(popoverTrigger).toHaveAttribute("aria-expanded", "true");
    expect(popover).toHaveAttribute("aria-label", "Nested popover");
    expect(popover).toHaveAttribute("data-state", "open");

    await user.keyboard("{Escape}");

    expect(onPopoverChange).toHaveBeenCalledWith(false);
    expect(onDialogChange).not.toHaveBeenCalled();
    expect(dialog).toHaveAttribute("data-state", "open");
    expect(popoverTrigger).toHaveAttribute("aria-expanded", "false");
    expect(popover).toHaveAttribute("data-state", "closed");
  });
});

describe("Nested overlay: Menu inside Dialog", () => {
  it("Escape on a menu with onClose closes only the menu (keydown defaultPrevented), not the dialog", async () => {
    const onDialogChange = vi.fn();
    const onMenuClose = vi.fn();

    render(
      <Dialog defaultOpen onOpenChange={onDialogChange}>
        <Dialog.Content>
          <Dialog.Title>Menu dialog</Dialog.Title>
          <Menu aria-label="Actions" autoFocus defaultHighlighted="one" onClose={onMenuClose}>
            <Menu.Item id="one">One</Menu.Item>
            <Menu.Item id="two">Two</Menu.Item>
          </Menu>
        </Dialog.Content>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Menu dialog" });
    const menu = screen.getByRole("menu", { name: "Actions" });
    await waitFor(() => expect(menu).toHaveFocus());

    const keydown = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    menu.dispatchEvent(keydown);

    // The menu consumes the Escape so the surrounding <dialog> cancel does not fire.
    expect(keydown.defaultPrevented).toBe(true);
    expect(onMenuClose).toHaveBeenCalled();
    expect(onDialogChange).not.toHaveBeenCalled();
    expect(dialog).toHaveAttribute("data-state", "open");
  });

  it("Escape on a submenu closes only the submenu (keydown defaultPrevented), not the dialog", async () => {
    const user = userEvent.setup();
    const onDialogChange = vi.fn();

    render(
      <Dialog defaultOpen onOpenChange={onDialogChange}>
        <Dialog.Content>
          <Dialog.Title>Submenu dialog</Dialog.Title>
          <Menu aria-label="Actions" autoFocus defaultHighlighted="edit">
            <Menu.Sub>
              <Menu.SubTrigger id="edit">Edit</Menu.SubTrigger>
              <Menu.SubContent>
                <Menu.Item id="undo">Undo</Menu.Item>
              </Menu.SubContent>
            </Menu.Sub>
          </Menu>
        </Dialog.Content>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Submenu dialog" });
    const parentMenu = screen.getByRole("menu", { name: "Actions" });
    await waitFor(() => expect(parentMenu).toHaveFocus());
    await user.keyboard("{ArrowRight}");

    const submenu = await waitFor(() => {
      const found = screen.getAllByRole("menu").find((candidate) => candidate !== parentMenu);
      if (!found) throw new Error("submenu not open");
      return found;
    });

    const keydown = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    submenu.dispatchEvent(keydown);

    expect(keydown.defaultPrevented).toBe(true);
    expect(onDialogChange).not.toHaveBeenCalled();
    expect(dialog).toHaveAttribute("data-state", "open");
  });
});

describe("Nested overlay: Dialog inside Dialog", () => {
  it("restores focus to the parent's last focused element after closing the child dialog", async () => {
    const user = userEvent.setup();
    function NestedDialogs() {
      const [parentOpen, setParentOpen] = useState(false);
      const [childOpen, setChildOpen] = useState(false);

      return (
        <>
          <button type="button" onClick={() => setParentOpen(true)}>
            Open parent
          </button>
          <Dialog open={parentOpen} onOpenChange={setParentOpen}>
            <Dialog.Content>
              <Dialog.Title>Parent dialog</Dialog.Title>
              <button type="button" onClick={() => setChildOpen(true)}>
                Open child
              </button>
              <Dialog.Close>Close parent</Dialog.Close>
            </Dialog.Content>
          </Dialog>
          <Dialog open={childOpen} onOpenChange={setChildOpen}>
            <Dialog.Content>
              <Dialog.Title>Child dialog</Dialog.Title>
              <Dialog.Close>Close child</Dialog.Close>
            </Dialog.Content>
          </Dialog>
        </>
      );
    }

    render(<NestedDialogs />);

    await user.click(screen.getByRole("button", { name: "Open parent" }));
    const childOpener = screen.getByRole("button", { name: "Open child" });
    await user.click(childOpener);

    const childDialog = screen.getByRole("dialog", { name: "Child dialog" });
    await user.click(screen.getByRole("button", { name: "Close child" }));
    await waitFor(() => expect(childDialog).toHaveAttribute("data-state", "closed"));
    // fireEvent retained: animationend has no user-event equivalent; presence transitions complete on this event
    fireEvent.animationEnd(childDialog);

    const parentDialog = screen.getByRole("dialog", { name: "Parent dialog" });
    expect(parentDialog).toHaveAttribute("data-state", "open");
    await waitFor(() => expect(childOpener).toHaveFocus());
  });

  it("keeps the topmost stacked dialog focused and interactive", async () => {
    const user = userEvent.setup();
    const firstAction = vi.fn();
    const secondAction = vi.fn();

    render(
      <>
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title>Dialog 1</Dialog.Title>
            <Dialog.Body>First body</Dialog.Body>
            <button type="button" onClick={firstAction}>
              First action
            </button>
          </Dialog.Content>
        </Dialog>
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title>Dialog 2</Dialog.Title>
            <Dialog.Body>Second body</Dialog.Body>
            {/* biome-ignore lint/a11y/noAutofocus: test fixture seeds initial focus inside the nested dialog to exercise nested-overlay focus/escape behavior. */}
            <button type="button" autoFocus onClick={secondAction}>
              Second action
            </button>
          </Dialog.Content>
        </Dialog>
      </>,
    );

    const firstDialog = screen.getByRole("dialog", { name: "Dialog 1" });
    const secondDialog = screen.getByRole("dialog", { name: "Dialog 2" });
    const secondActionButton = screen.getByRole("button", { name: "Second action" });

    await waitFor(() => expect(secondActionButton).toHaveFocus());
    await user.click(secondActionButton);

    expect(secondAction).toHaveBeenCalledOnce();
    expect(firstAction).not.toHaveBeenCalled();
    expect(firstDialog).toHaveAttribute("data-state", "open");
    expect(secondDialog).toHaveAttribute("data-state", "open");
  });
});
