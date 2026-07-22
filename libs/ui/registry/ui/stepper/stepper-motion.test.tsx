import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Stepper, type StepperProps } from "./index";

function renderStepper(props: Partial<StepperProps> = {}) {
  return render(
    <Stepper {...props}>
      <Stepper.Step stepId="s1" status="completed">
        <Stepper.Trigger>Step 1</Stepper.Trigger>
        <Stepper.Content>Content 1</Stepper.Content>
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

describe("Stepper prefers-reduced-motion", () => {
  // jsdom evaluates no @media, so Tailwind's motion-reduce/motion-safe rules are
  // injected unconditionally to simulate matchMedia true; getComputedStyle then
  // reports the suppressed transition and absent animation.
  let styleElement: HTMLStyleElement | null = null;

  beforeAll(() => {
    styleElement = document.createElement("style");
    styleElement.dataset.testSource = "tailwind#motion-reduce+motion-safe";
    styleElement.textContent = `
      .motion-reduce\\:transition-none { transition-property: none; }
      .motion-safe\\:animate-pulse { animation: none; }
    `;
    document.head.appendChild(styleElement);
  });

  afterAll(() => {
    styleElement?.remove();
    styleElement = null;
  });

  it("suppresses the grid-row transition on the animated wrapper", () => {
    renderStepper({ defaultExpandedIds: ["s1"] });
    const region = screen.getByRole("region", { name: /Step 1/ });
    expect(getComputedStyle(region).transitionProperty).toBe("none");
  });

  it("applies the active substep pulse only via motion-safe variant", () => {
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
          <Stepper.Content>
            <Stepper.Substep tag="A" label="Working" status="active" />
          </Stepper.Content>
        </Stepper.Step>
      </Stepper>,
    );

    const substep = screen.getByText("Working").parentElement;
    if (!substep) throw new Error("Expected substep label to have a parent element");
    expect(getComputedStyle(substep).animation).toBe("none");
  });
});
