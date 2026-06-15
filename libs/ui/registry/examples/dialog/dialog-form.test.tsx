import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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
});
