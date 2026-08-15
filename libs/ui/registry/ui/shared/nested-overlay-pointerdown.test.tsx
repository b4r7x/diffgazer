import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "../dialog/index";
import { Menu } from "../menu/index";
import { Popover } from "../popover/index";
import { Select } from "../select/index";

// Backdrop close compares the click coordinate to the dialog's bounding rect;
// jsdom layout is 0x0, so mock the rect so (10,10) reads as "outside".
function mockDialogBounds(dialog: HTMLElement) {
  vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
    x: 100,
    y: 100,
    width: 320,
    height: 240,
    top: 100,
    right: 420,
    bottom: 340,
    left: 100,
    toJSON() {},
  });
}

describe("Nested overlay: outside-press consumes exactly one layer", () => {
  it("swallows activation on a disabled click Popover after dismissing its peer", async () => {
    const user = userEvent.setup();
    const onDisabledClick = vi.fn();

    render(
      <>
        <Popover triggerMode="click" defaultOpen>
          <Popover.Trigger>Open popover</Popover.Trigger>
          <Popover.Content role="dialog" aria-label="Open popover content">
            Open content
          </Popover.Content>
        </Popover>
        <Popover triggerMode="click" enabled={false}>
          <Popover.Trigger>
            <button type="button" onClick={onDisabledClick}>
              <span>Disabled popover</span>
            </button>
          </Popover.Trigger>
          <Popover.Content role="dialog" aria-label="Disabled popover content">
            Disabled content
          </Popover.Content>
        </Popover>
      </>,
    );

    const openTrigger = screen.getByRole("button", { name: "Open popover" });
    const disabledTrigger = screen.getByRole("button", { name: "Disabled popover" });
    expect(openTrigger).toHaveAttribute("aria-expanded", "true");
    expect(disabledTrigger).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByText("Disabled popover"));

    await waitFor(() => expect(openTrigger).toHaveAttribute("aria-expanded", "false"));
    expect(disabledTrigger).toHaveAttribute("aria-expanded", "false");
    expect(onDisabledClick).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: "Disabled popover content" }),
    ).not.toBeInTheDocument();
  });

  it("opens a sibling click Popover with the click that dismisses the current Popover", async () => {
    const user = userEvent.setup();

    render(
      <>
        <Popover triggerMode="click" defaultOpen>
          <Popover.Trigger>First popover</Popover.Trigger>
          <Popover.Content role="dialog" aria-label="First popover content">
            First content
          </Popover.Content>
        </Popover>
        <Popover triggerMode="click">
          <Popover.Trigger>
            {({
              ref,
              onClick,
              "aria-controls": ariaControls,
              "aria-expanded": ariaExpanded,
              "aria-haspopup": ariaHasPopup,
            }) => (
              <button
                ref={ref}
                type="button"
                aria-controls={ariaControls}
                aria-expanded={ariaExpanded}
                aria-haspopup={ariaHasPopup}
                onClick={onClick}
              >
                <span>Second popover</span>
              </button>
            )}
          </Popover.Trigger>
          <Popover.Content role="dialog" aria-label="Second popover content">
            Second content
          </Popover.Content>
        </Popover>
      </>,
    );

    const firstTrigger = screen.getByRole("button", { name: "First popover" });
    const secondTrigger = screen.getByRole("button", { name: "Second popover" });
    expect(firstTrigger).toHaveAttribute("aria-expanded", "true");
    expect(secondTrigger).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByText("Second popover"));

    await waitFor(() => expect(firstTrigger).toHaveAttribute("aria-expanded", "false"));
    expect(secondTrigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Second popover content" })).toBeVisible();
  });

  it("opens a sibling flyout submenu with the click that dismisses the current submenu", async () => {
    const user = userEvent.setup();

    render(
      <Menu aria-label="Actions">
        <Menu.Sub mode="flyout" defaultOpen>
          <Menu.SubTrigger id="edit">Edit</Menu.SubTrigger>
          <Menu.SubContent>
            <Menu.Item id="undo">Undo</Menu.Item>
          </Menu.SubContent>
        </Menu.Sub>
        <Menu.Sub mode="flyout">
          <Menu.SubTrigger id="view">View</Menu.SubTrigger>
          <Menu.SubContent>
            <Menu.Item id="zoom">Zoom</Menu.Item>
          </Menu.SubContent>
        </Menu.Sub>
      </Menu>,
    );

    const editTrigger = screen.getByRole("menuitem", { name: "Edit" });
    const viewTrigger = screen.getByRole("menuitem", { name: "View" });
    expect(editTrigger).toHaveAttribute("aria-expanded", "true");
    expect(viewTrigger).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByText("View"));

    await waitFor(() => expect(editTrigger).toHaveAttribute("aria-expanded", "false"));
    expect(viewTrigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "View" })).toBeVisible();
  });

  it("opens a sibling Select with the click that dismisses the current Select", async () => {
    const user = userEvent.setup();

    render(
      <>
        <Select defaultOpen>
          <Select.Trigger aria-label="First choice">
            <span>First choice</span>
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
          </Select.Content>
        </Select>
        <Select>
          <Select.Trigger aria-label="Second choice">
            <span>Second choice</span>
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="banana">Banana</Select.Item>
          </Select.Content>
        </Select>
      </>,
    );

    const firstTrigger = screen.getByRole("combobox", { name: "First choice" });
    const secondTrigger = screen.getByRole("combobox", { name: "Second choice" });
    expect(firstTrigger).toHaveAttribute("aria-expanded", "true");
    expect(secondTrigger).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByText("Second choice"));

    await waitFor(() => expect(firstTrigger).toHaveAttribute("aria-expanded", "false"));
    expect(secondTrigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox", { name: "Second choice" })).toBeVisible();
  });

  it("keeps the ancestor popover open when its own trigger dismisses a nested select", async () => {
    const user = userEvent.setup();
    const onPopoverChange = vi.fn();

    render(
      <Popover triggerMode="click" defaultOpen onOpenChange={onPopoverChange}>
        <Popover.Trigger>Filters</Popover.Trigger>
        <Popover.Content role="dialog" aria-label="Filters content">
          <Select defaultOpen>
            <Select.Trigger aria-label="Fruit">
              <span>Fruit</span>
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="apple">Apple</Select.Item>
            </Select.Content>
          </Select>
        </Popover.Content>
      </Popover>,
    );

    const popoverTrigger = screen.getByRole("button", { name: "Filters" });
    const selectTrigger = screen.getByRole("combobox", { name: "Fruit" });
    expect(popoverTrigger).toHaveAttribute("aria-expanded", "true");
    expect(selectTrigger).toHaveAttribute("aria-expanded", "true");

    await user.click(popoverTrigger);

    await waitFor(() => expect(selectTrigger).toHaveAttribute("aria-expanded", "false"));
    expect(popoverTrigger).toHaveAttribute("aria-expanded", "true");
    expect(onPopoverChange).not.toHaveBeenCalledWith(false);

    await user.click(popoverTrigger);

    await waitFor(() => expect(popoverTrigger).toHaveAttribute("aria-expanded", "false"));
    expect(onPopoverChange).toHaveBeenCalledWith(false);
  });

  it("a backdrop press closes only the open Select, leaving the dialog open until a second press", async () => {
    const onDialogChange = vi.fn();

    render(
      <Dialog defaultOpen onOpenChange={onDialogChange}>
        <Dialog.Content>
          <Dialog.Title>Settings</Dialog.Title>
          <Dialog.Body>
            <Select variant="default" defaultOpen>
              <Select.Trigger>
                <Select.Value placeholder="Pick" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="apple">Apple</Select.Item>
                <Select.Item value="banana">Banana</Select.Item>
              </Select.Content>
            </Select>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog", { name: "Settings" });
    mockDialogBounds(dialog);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(dialog).toHaveAttribute("data-state", "open");

    // First backdrop press (on the <dialog>, outside the listbox) dismisses the
    // select; its capture-phase pointerdown also arms the one-shot click swallow,
    // so the follow-up click never reaches the dialog's backdrop-close path.
    // fireEvent retained: pointerdown/click coordinate pair asserts backdrop hit-testing and click-swallow ordering.
    fireEvent.pointerDown(dialog, { clientX: 10, clientY: 10 });
    // fireEvent retained: pointerdown/click coordinate pair asserts backdrop hit-testing and click-swallow ordering.
    fireEvent.click(dialog, { clientX: 10, clientY: 10, detail: 1 });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    expect(dialog).toHaveAttribute("data-state", "open");
    expect(onDialogChange).not.toHaveBeenCalled();

    // Second backdrop press: the select is closed, nothing swallows the click,
    // so the dialog's backdrop-close now fires.
    // fireEvent retained: pointerdown/click coordinate pair asserts backdrop hit-testing once the select is closed.
    fireEvent.pointerDown(dialog, { clientX: 10, clientY: 10 });
    // fireEvent retained: pointerdown/click coordinate pair asserts backdrop hit-testing once the select is closed.
    fireEvent.click(dialog, { clientX: 10, clientY: 10, detail: 1 });
    await waitFor(() => expect(onDialogChange).toHaveBeenCalledWith(false));
  });

  it("does not treat a third-party generic overlay marker as an activatable peer", async () => {
    const user = userEvent.setup();
    const onButtonClick = vi.fn();

    render(
      <>
        <Select variant="default" defaultOpen>
          <Select.Trigger>
            <Select.Value placeholder="Pick" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
          </Select.Content>
        </Select>
        <button type="button" data-overlay-trigger="" onClick={onButtonClick}>
          Underlying
        </button>
      </>,
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Underlying" }));

    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    expect(onButtonClick).not.toHaveBeenCalled();
  });

  it("swallows the dismissing gesture's click when the click arrives on a later macrotask", async () => {
    vi.useFakeTimers();
    const onButtonClick = vi.fn();

    try {
      render(
        <>
          <Select variant="default" defaultOpen>
            <Select.Trigger>
              <Select.Value placeholder="Pick" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="apple">Apple</Select.Item>
            </Select.Content>
          </Select>
          <button type="button" onClick={onButtonClick}>
            Underlying
          </button>
        </>,
      );

      const trigger = screen.getByRole("combobox");
      const button = screen.getByRole("button", { name: "Underlying" });
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      // fireEvent retained: split pointerdown and click across macrotasks to model browser gesture timing.
      fireEvent.pointerDown(button);
      await vi.advanceTimersByTimeAsync(50);
      // detail: 1 is what a browser reports for a pointer click; the swallow ignores
      // detail: 0, which is how a keyboard activation arrives.
      // fireEvent retained: click must be swallowed even after delayed browser dispatch.
      fireEvent.click(button, { detail: 1 });

      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(onButtonClick).not.toHaveBeenCalled();

      // fireEvent retained: a second, ordinary click on the same button proves
      // the swallow was one-shot and normal clicks still reach the handler.
      fireEvent.click(button, { detail: 1 });
      expect(onButtonClick).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
