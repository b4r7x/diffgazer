import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Stepper } from "./index";

describe("Stepper live region announcements", () => {
  it("renders a polite live region with the active step announcement", () => {
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="completed">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="active">
          <Stepper.Trigger>Step 2</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s3" status="pending">
          <Stepper.Trigger>Step 3</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Step 2 of 3: Step 2");
  });

  it("keeps the status live region mounted when no step is active", () => {
    render(
      <Stepper>
        <Stepper.Step stepId="s1" status="completed">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="completed">
          <Stepper.Trigger>Step 2</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("");
  });

  it("resolves the active step and its label through a consumer wrapper component", () => {
    function WrappedStep({
      stepId,
      status,
      label,
    }: {
      stepId: string;
      status: "completed" | "active" | "pending";
      label: string;
    }) {
      return (
        <Stepper.Step stepId={stepId} status={status}>
          <Stepper.Trigger>{label}</Stepper.Trigger>
        </Stepper.Step>
      );
    }

    render(
      <Stepper>
        <WrappedStep stepId="s1" status="completed" label="Step 1" />
        <WrappedStep stepId="s2" status="active" label="Step 2" />
        <WrappedStep stepId="s3" status="pending" label="Step 3" />
      </Stepper>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Step 2 of 3: Step 2");
  });
});
