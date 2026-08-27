import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StepStatus } from "@/lib/step-status";
import type { StepperVariant } from "@/lib/stepper-variants";
import { Stepper } from "./index";

describe("Stepper variant indicators", () => {
  it("uses provided statusLabels for tag-variant indicators", () => {
    render(
      <Stepper variant="tag">
        <Stepper.Step stepId="s1" status="completed">
          <Stepper.Trigger statusLabels={{ completed: "PASS", active: "WORK" }}>
            Step 1
          </Stepper.Trigger>
        </Stepper.Step>
        <Stepper.Step stepId="s2" status="active">
          <Stepper.Trigger statusLabels={{ completed: "PASS", active: "WORK" }}>
            Step 2
          </Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );
    expect(screen.getByRole("button", { name: /Step 1/ })).toHaveTextContent("PASS");
    expect(screen.getByRole("button", { name: /Step 2/ })).toHaveTextContent("WORK");
  });

  // jsdom cannot measure color, so the merged class IS the contract these slots exist for:
  // an app palette must win over the variant's own state classes.
  it("merges indicatorClassName and labelClassName over the variant state classes", () => {
    render(
      <Stepper variant="tag">
        <Stepper.Step stepId="s1" status="active">
          <Stepper.Trigger indicatorClassName="bg-info-bg" labelClassName="text-info-text">
            Step 1
          </Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    const trigger = screen.getByRole("button", { name: /Step 1/ });
    const [indicator, label] = Array.from(trigger.children) as HTMLElement[];
    expect(indicator).toHaveClass("bg-info-bg");
    expect(indicator).not.toHaveClass("bg-foreground");
    expect(label).toHaveClass("text-info-text");
    expect(label).not.toHaveClass("text-foreground");
  });

  it.each([
    "ascii",
    "numbered",
    "bullet",
    "progress",
  ] as const)("uses provided statusLabels as the %s indicator's screen-reader text", (variant) => {
    render(
      <Stepper variant={variant}>
        <Stepper.Step stepId="s1" status="completed">
          <Stepper.Trigger statusLabels={{ completed: "Succeeded:" }}>Step 1</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );

    const trigger = screen.getByRole("button", { name: /Step 1/ });
    expect(trigger).toHaveAccessibleName(/Succeeded:.*Step 1/);
    expect(trigger).not.toHaveAccessibleName(/Completed:/);
  });

  interface IndicatorExpectation {
    status: StepStatus;
    glyph: string;
  }

  // Explicit per-(variant, status) glyph table. Numbered's pending/active cells render via a
  // CSS counter (no literal text node), so only its visible completed/error/skipped/disabled
  // cells are asserted.
  const STEPPER_INDICATOR_EXPECTATIONS: Record<StepperVariant, IndicatorExpectation[]> = {
    ascii: [
      { status: "pending", glyph: "[ ]" },
      { status: "active", glyph: "[~]" },
      { status: "completed", glyph: "[x]" },
      { status: "error", glyph: "[!]" },
      { status: "skipped", glyph: "[—]" },
      { status: "disabled", glyph: "[/]" },
    ],
    numbered: [
      { status: "completed", glyph: "✓" },
      { status: "error", glyph: "!" },
      { status: "skipped", glyph: "—" },
      { status: "disabled", glyph: "·" },
    ],
    bullet: [
      { status: "pending", glyph: "·" },
      { status: "active", glyph: "›" },
      { status: "completed", glyph: "•" },
      { status: "error", glyph: "×" },
      { status: "skipped", glyph: "—" },
      { status: "disabled", glyph: "·" },
    ],
    tag: [
      { status: "pending", glyph: "WAIT" },
      { status: "active", glyph: "RUN" },
      { status: "completed", glyph: "DONE" },
      { status: "error", glyph: "FAIL" },
      { status: "skipped", glyph: "SKIP" },
      { status: "disabled", glyph: "OFF" },
    ],
    progress: [
      { status: "pending", glyph: "░░░" },
      { status: "active", glyph: "█▌░" },
      { status: "completed", glyph: "███" },
      { status: "error", glyph: "!!!" },
      { status: "skipped", glyph: "———" },
      { status: "disabled", glyph: "···" },
    ],
  };

  it.each(
    Object.entries(STEPPER_INDICATOR_EXPECTATIONS) as [StepperVariant, IndicatorExpectation[]][],
  )("renders the %s glyph for every visible status cell", (variant, expectations) => {
    render(
      <Stepper variant={variant}>
        {expectations.map(({ status }) => (
          <Stepper.Step key={status} stepId={status} status={status}>
            <Stepper.Trigger>{`Label-${status}`}</Stepper.Trigger>
          </Stepper.Step>
        ))}
      </Stepper>,
    );

    for (const { status, glyph } of expectations) {
      const trigger = screen.getByRole("button", { name: new RegExp(`Label-${status}`) });
      expect(trigger).toHaveTextContent(glyph);
    }
  });

  it("writes data-variant on the root list and data-status on each step", () => {
    render(
      <Stepper variant="bullet">
        <Stepper.Step stepId="s1" status="skipped">
          <Stepper.Trigger>Step 1</Stepper.Trigger>
        </Stepper.Step>
      </Stepper>,
    );
    const list = screen.getByRole("list", { name: /Progress steps/ });
    expect(list).toHaveAttribute("data-variant", "bullet");
    const step = screen.getByRole("listitem");
    expect(step).toHaveAttribute("data-status", "skipped");
  });
});
