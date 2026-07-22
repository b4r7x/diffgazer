import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import ControllableStateBasic from "./controllable-state-basic";

describe("ControllableStateBasic", () => {
  it("labels both inputs by their visible names and updates value and label as the user types", async () => {
    const user = userEvent.setup();
    render(<ControllableStateBasic />);

    const uncontrolled = screen.getByRole("textbox", { name: "Uncontrolled" });
    const controlled = screen.getByRole("textbox", { name: "Controlled: hello" });

    expect(uncontrolled).toHaveAttribute("name", "uncontrolled");
    expect(controlled).toHaveAttribute("name", "controlled");

    await user.type(uncontrolled, " typed");
    expect(uncontrolled).toHaveValue("type here… typed");

    await user.clear(controlled);
    await user.type(controlled, "world");

    expect(controlled).toHaveValue("world");
    expect(screen.getByRole("textbox", { name: "Controlled: world" })).toBe(controlled);
  });
});
