import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import DialogKeyboard from "./dialog-keyboard";

describe("dialog-keyboard example", () => {
  it("moves focus from Cancel to Delete on ArrowRight", async () => {
    const user = userEvent.setup();
    render(<DialogKeyboard />);

    await user.click(screen.getByRole("button", { name: "Delete Branch" }));

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const deleteAction = screen.getByRole("button", { name: "Delete" });
    cancel.focus();

    await user.keyboard("{ArrowRight}");

    expect(deleteAction).toHaveFocus();
  });
});
