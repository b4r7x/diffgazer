import { Stepper } from "@diffgazer/ui/components/stepper";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressStep } from "./step";

function renderInStepper(node: React.ReactNode) {
  // Progress UI uses variant="tag" to render text status labels (DONE/RUN/etc).
  return render(<Stepper variant="tag">{node}</Stepper>);
}

describe("ProgressStep label bridge", () => {
  it("passes app-specific step status labels (DONE/RUN/WAIT) to the stepper trigger", () => {
    renderInStepper(
      <>
        <ProgressStep stepId="s1" label="Parse" status="completed" />
        <ProgressStep stepId="s2" label="Analyze" status="active" />
        <ProgressStep stepId="s3" label="Build" status="pending" />
      </>,
    );

    expect(screen.getByRole("button", { name: /Parse/ })).toHaveTextContent("DONE");
    expect(screen.getByRole("button", { name: /Analyze/ })).toHaveTextContent("RUN");
    expect(screen.getByRole("button", { name: /Build/ })).toHaveTextContent("WAIT");
  });

  it("renders steps as static lines that cannot expand", () => {
    renderInStepper(<ProgressStep stepId="s1" label="Parse" status="active" />);

    const step = screen.getByRole("button", { name: /Parse/ });
    expect(step).toBeDisabled();
    expect(step).not.toHaveAttribute("aria-expanded");
  });
});
