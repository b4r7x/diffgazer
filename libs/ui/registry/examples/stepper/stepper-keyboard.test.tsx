import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import StepperKeyboard from "./stepper-keyboard";

function panelFor(trigger: HTMLElement): HTMLElement {
  const panelId = trigger.getAttribute("aria-controls");
  if (!panelId) throw new Error("Expected the step trigger to reference its panel");
  const panel = document.getElementById(panelId);
  if (!panel) throw new Error(`Expected a step panel with id ${panelId}`);
  return panel;
}

describe("stepper-keyboard example", () => {
  it("tabs into the list, moves focus with arrows, and toggles expansion with Enter and Space", async () => {
    const user = userEvent.setup();
    render(<StepperKeyboard />);

    expect(screen.getByText("Compiled 128 modules in 4.7s.")).toBeInTheDocument();

    const runTests = screen.getByRole("button", { name: /Run test suite/ });
    const buildProject = screen.getByRole("button", { name: /Build project/ });
    const deployStaging = screen.getByRole("button", { name: /Deploy to staging/ });

    await user.tab();
    expect(runTests).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(deployStaging).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(runTests).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(buildProject).toHaveFocus();

    // The collapsed panel is clipped by the 0fr grid track so the collapse can animate, and
    // jsdom computes no stylesheet — inert/aria-hidden carry the state a test can observe.
    await user.keyboard(" ");
    expect(buildProject).toHaveAttribute("aria-expanded", "false");
    expect(panelFor(buildProject)).toHaveAttribute("inert");
    expect(panelFor(buildProject)).toHaveAttribute("aria-hidden", "true");

    await user.keyboard("{Enter}");
    expect(buildProject).toHaveAttribute("aria-expanded", "true");
    expect(panelFor(buildProject)).not.toHaveAttribute("inert");
    expect(panelFor(buildProject)).not.toHaveAttribute("aria-hidden");
  });
});
