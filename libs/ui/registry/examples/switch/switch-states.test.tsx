import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SwitchStates from "./switch-states";

describe("switch states example", () => {
  it("keeps caption, accessible name, and checked state aligned after a toggle", async () => {
    const user = userEvent.setup();
    render(<SwitchStates />);

    const control = screen.getByRole("switch", { name: "sm unchecked" });
    expect(control).not.toBeChecked();

    await user.click(control);

    expect(control).toBeChecked();
    expect(control).toHaveAccessibleName("sm checked");
    expect(screen.getAllByText("checked").length).toBeGreaterThan(1);
  });

  it("leaves disabled rows fixed", async () => {
    const user = userEvent.setup();
    render(<SwitchStates />);

    const disabled = screen.getByRole("switch", { name: "md disabled checked" });
    expect(disabled).toBeChecked();
    expect(disabled).toBeDisabled();

    await user.click(disabled);

    expect(disabled).toBeChecked();
    expect(disabled).toHaveAccessibleName("md disabled checked");
  });
});
