import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ControllableStateBasic from "./controllable-state-basic";

describe("ControllableStateBasic", () => {
  it("labels both inputs by their visible names and gives them form identifiers", () => {
    render(<ControllableStateBasic />);

    const uncontrolled = screen.getByRole("textbox", { name: "Uncontrolled" });
    const controlled = screen.getByRole("textbox", { name: "Controlled: hello" });

    expect(uncontrolled).toHaveAttribute("id", "uncontrolled-input");
    expect(uncontrolled).toHaveAttribute("name", "uncontrolled");
    expect(controlled).toHaveAttribute("id", "controlled-input");
    expect(controlled).toHaveAttribute("name", "controlled");
  });
});
