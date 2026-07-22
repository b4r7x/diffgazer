import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DialogForm from "./dialog-form";

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
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
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

      render(<DialogForm />);

      await interact(() => user.click(screen.getByRole("button", { name: "New Project" })));

      const dialog = screen.getByRole("dialog");
      const input = screen.getByRole("textbox", { name: /project name/i });

      await interact(() => user.click(input));
      await interact(() => user.keyboard("{Enter}"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(dialog).toHaveAttribute("data-state", "open");

      await interact(() => user.type(input, "my-project"));
      await interact(() => user.keyboard("{Enter}"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(dialog).toHaveAttribute("data-state", "closed");
    } finally {
      vi.useRealTimers();
    }
  });
});
