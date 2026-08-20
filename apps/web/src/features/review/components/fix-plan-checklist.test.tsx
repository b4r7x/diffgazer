import { MARKER_RAIL_SELECTED } from "@diffgazer/ui/lib/marker-rail";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FixPlanChecklist } from "./fix-plan-checklist";

const STEPS = [{ completionIndex: 0, number: 1, action: "Validate input", files: [] }];

function renderChecklist() {
  render(
    <FixPlanChecklist
      steps={STEPS}
      completedSteps={new Set()}
      onToggle={vi.fn()}
      focusedStepIndex={0}
    />,
  );
  return screen.getByRole("checkbox", { name: /1\. Validate input/ });
}

describe("FixPlanChecklist", () => {
  // jsdom cannot compute the rendered rail, so the yield rule is asserted at the
  // documented-contract level: the override has to name the same border token
  // the library's marker rail draws the highlight with.
  it("yields every part of the collection highlight to real focus", () => {
    const step = renderChecklist();

    expect(step).toHaveClass(...MARKER_RAIL_SELECTED.split(" "));
    expect(step).toHaveClass("data-highlighted:focus:border-l-transparent");
    expect(step).toHaveClass("data-highlighted:focus:bg-transparent");
    expect(step).toHaveClass("data-highlighted:focus:font-normal");
  });
});
