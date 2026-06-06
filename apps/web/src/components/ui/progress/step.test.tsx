import { Stepper } from "@diffgazer/ui/components/stepper";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressStep } from "./step";

function renderInStepper(node: React.ReactNode) {
  // Progress UI uses variant="tag" to render text status labels (DONE/RUN/etc).
  return render(<Stepper variant="tag" defaultExpandedIds={["s1"]}>{node}</Stepper>);
}

describe("ProgressStep label bridge", () => {
  it("passes app-specific step status labels (DONE/RUN/WAIT/FAIL) to the stepper trigger", () => {
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

  it("passes app-specific substep status labels (analyzing.../done/failed) when no detail is set", () => {
    renderInStepper(
      <ProgressStep
        stepId="s1"
        label="Run"
        status="active"
        substeps={[
          { id: "a", tag: "A", label: "Substep A", status: "active" },
          { id: "b", tag: "B", label: "Substep B", status: "completed" },
          { id: "c", tag: "C", label: "Substep C", status: "error" },
        ]}
      />,
    );

    expect(screen.getByText("analyzing...")).toBeInTheDocument();
    expect(screen.getByText("done")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
  });

  it("prefers explicit substep detail over the app-specific status label fallback", () => {
    renderInStepper(
      <ProgressStep
        stepId="s1"
        label="Run"
        status="active"
        substeps={[
          { id: "a", tag: "A", label: "Substep A", status: "active", detail: "explicit detail" },
        ]}
      />,
    );

    expect(screen.getByText("explicit detail")).toBeInTheDocument();
    expect(screen.queryByText("analyzing...")).not.toBeInTheDocument();
  });
});
