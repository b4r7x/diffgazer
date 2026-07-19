import { Stepper } from "@diffgazer/ui/components/stepper";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressStep } from "./step";

function renderInStepper(node: React.ReactNode) {
  return render(<Stepper variant="tag">{node}</Stepper>);
}

describe("ProgressStep", () => {
  it("renders the default tag label for each progress status", () => {
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
