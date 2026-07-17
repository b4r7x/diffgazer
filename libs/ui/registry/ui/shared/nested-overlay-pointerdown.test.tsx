import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "../dialog/index";
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
    fireEvent.click(dialog, { clientX: 10, clientY: 10 });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    expect(dialog).toHaveAttribute("data-state", "open");
    expect(onDialogChange).not.toHaveBeenCalled();

    // Second backdrop press: the select is closed, nothing swallows the click,
    // so the dialog's backdrop-close now fires.
    // fireEvent retained: pointerdown/click coordinate pair asserts backdrop hit-testing once the select is closed.
    fireEvent.pointerDown(dialog, { clientX: 10, clientY: 10 });
    // fireEvent retained: pointerdown/click coordinate pair asserts backdrop hit-testing once the select is closed.
    fireEvent.click(dialog, { clientX: 10, clientY: 10 });
    await waitFor(() => expect(onDialogChange).toHaveBeenCalledWith(false));
  });

  it("closing a Select by pressing an underlying button does not activate the button", async () => {
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
        <button type="button" onClick={onButtonClick}>
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
      // fireEvent retained: click must be swallowed even after delayed browser dispatch.
      fireEvent.click(button);

      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(onButtonClick).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not swallow a normal click when no overlay is open", async () => {
    const user = userEvent.setup();
    const onButtonClick = vi.fn();
    render(
      <button type="button" onClick={onButtonClick}>
        Plain
      </button>,
    );

    await user.click(screen.getByRole("button", { name: "Plain" }));
    expect(onButtonClick).toHaveBeenCalledOnce();
  });
});
