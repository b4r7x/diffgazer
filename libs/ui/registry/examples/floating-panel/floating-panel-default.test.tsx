import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import FloatingPanelDefaultExample from "./floating-panel-default";

describe("floating-panel default example", () => {
  it("connects the trigger to the named dialog and restores focus after Escape", async () => {
    const user = userEvent.setup();
    render(<FloatingPanelDefaultExample />);

    const trigger = screen.getByRole("button", { name: "open panel" });
    await user.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Quick info" });
    const dismiss = screen.getByRole("button", { name: "dismiss" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", dialog.id);
    await waitFor(() => expect(dismiss).toHaveFocus());

    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("aria-controls");
  });

  it("restores trigger focus when the dismiss button closes the dialog", async () => {
    const user = userEvent.setup();
    render(<FloatingPanelDefaultExample />);

    const trigger = screen.getByRole("button", { name: "open panel" });
    await user.click(trigger);
    const dismiss = await screen.findByRole("button", { name: "dismiss" });
    await waitFor(() => expect(dismiss).toHaveFocus());

    await user.click(dismiss);
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
