import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DialogForm from "./dialog-form";

// The example's create transition is a real setTimeout, so the pending window only
// exists between "started" and "timer advanced". Fake timers hold it open.
function setupFakeTimerRun() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

  const user = userEvent.setup({
    delay: null,
    advanceTimers: (delay) => {
      vi.advanceTimersByTime(delay);
    },
  });

  // user-event still awaits a zero-delay setTimeout internally, which fake
  // timers never fire on their own; flush it after starting each interaction.
  const interact = async (run: () => Promise<void>) => {
    const interaction = run();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await interaction;
  };

  const advance = async (ms: number) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  };

  return { user, interact, advance };
}

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

function fireBackdropClick(dialog: HTMLElement) {
  const outside = { clientX: 10, clientY: 10 };
  // fireEvent retained: backdrop hit testing needs explicit pointer coordinates outside the dialog bounds.
  fireEvent.pointerDown(dialog, outside);
  // fireEvent retained: the click coordinates must match the pointerdown for the shell backdrop contract.
  fireEvent.click(dialog, outside);
}

function fireEscape(dialog: HTMLElement) {
  // fireEvent retained: the native <dialog> cancel event has no user-event equivalent.
  fireEvent(dialog, new Event("cancel", { bubbles: false }));
}

describe("DialogForm example", () => {
  it("submits on Enter and closes the dialog", async () => {
    const user = userEvent.setup();
    render(<DialogForm />);

    await user.click(screen.getByRole("button", { name: "New Project" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("data-state", "open");

    const input = await screen.findByRole("textbox", { name: /project name/i });
    await user.type(input, "my-project");

    // Enter from inside the form's single text field triggers implicit submission,
    // which (after the create transition) closes the dialog.
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(dialog).toHaveAttribute("data-state", "closed");
    });
  });

  it("ignores Enter on a blank name and submits once a name is entered", async () => {
    const { user, interact, advance } = setupFakeTimerRun();
    try {
      render(<DialogForm />);

      await interact(() => user.click(screen.getByRole("button", { name: "New Project" })));

      const dialog = screen.getByRole("dialog");
      const input = screen.getByRole("textbox", { name: /project name/i });

      await interact(() => user.click(input));
      await interact(() => user.keyboard("{Enter}"));
      await advance(1000);
      expect(dialog).toHaveAttribute("data-state", "open");

      await interact(() => user.type(input, "my-project"));
      await interact(() => user.keyboard("{Enter}"));
      await advance(1000);
      expect(dialog).toHaveAttribute("data-state", "closed");
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses Escape, backdrop, and Cancel dismissal while the project is being created", async () => {
    const { user, interact, advance } = setupFakeTimerRun();
    try {
      render(<DialogForm />);

      await interact(() => user.click(screen.getByRole("button", { name: "New Project" })));

      const dialog = screen.getByRole("dialog");
      mockDialogBounds(dialog);
      const input = screen.getByRole("textbox", { name: /project name/i });

      await interact(() => user.type(input, "my-project"));
      await interact(() => user.keyboard("{Enter}"));

      expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();
      const cancel = screen.getByRole("button", { name: /cancel/i });
      expect(cancel).toBeDisabled();

      fireEscape(dialog);
      expect(dialog).toHaveAttribute("data-state", "open");

      fireBackdropClick(dialog);
      expect(dialog).toHaveAttribute("data-state", "open");

      await interact(() => user.click(cancel));
      expect(dialog).toHaveAttribute("data-state", "open");
      expect(input).toHaveValue("my-project");

      await advance(1000);
      expect(dialog).toHaveAttribute("data-state", "closed");
      expect(input).toHaveValue("");
    } finally {
      vi.restoreAllMocks();
      vi.useRealTimers();
    }
  });
});
