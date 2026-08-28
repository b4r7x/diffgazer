import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Stepper, type StepperProps } from "./index";

function renderStepper(props: Partial<StepperProps> = {}) {
  return render(
    <Stepper {...props}>
      <Stepper.Step stepId="s1" status="completed">
        <Stepper.Trigger>Step 1</Stepper.Trigger>
        {/* region: opt in on one step so the panel is reachable by role in assertions. */}
        <Stepper.Content region>Content 1</Stepper.Content>
      </Stepper.Step>
      <Stepper.Step stepId="s2" status="active">
        <Stepper.Trigger>Step 2</Stepper.Trigger>
        <Stepper.Content>Content 2</Stepper.Content>
      </Stepper.Step>
      <Stepper.Step stepId="s3" status="pending">
        <Stepper.Trigger>Step 3</Stepper.Trigger>
        <Stepper.Content>Content 3</Stepper.Content>
      </Stepper.Step>
    </Stepper>,
  );
}

// The motion variant classes are the public contract; jsdom evaluates no @media
// query, so the real suppression belongs to a browser-based test.
describe("Stepper prefers-reduced-motion", () => {
  it("gates the grid-row transition on the animated wrapper behind motion-reduce", () => {
    renderStepper({ defaultExpandedIds: ["s1"] });
    expect(screen.getByRole("region", { name: /Step 1/ })).toHaveClass(
      "motion-reduce:transition-none",
    );
  });

  it("gates the active substep pulse behind motion-safe and omits it for other statuses", () => {
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
          <Stepper.Content>
            <Stepper.Substep tag="A" label="Working" status="active" />
            <Stepper.Substep tag="B" label="Waiting" status="pending" />
          </Stepper.Content>
        </Stepper.Step>
      </Stepper>,
    );

    expect(screen.getByText("Working").parentElement).toHaveClass("motion-safe:animate-pulse");
    expect(screen.getByText("Waiting").parentElement).not.toHaveClass("motion-safe:animate-pulse");
  });
});
