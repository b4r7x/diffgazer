import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewCompleteSummary } from "./complete-summary";

describe("ReviewCompleteSummary", () => {
  it("uses the singular issue label for a one-issue review", () => {
    render(
      <ReviewCompleteSummary
        stats={{ runId: "run-1", totalIssues: 1, filesWithIssues: 1, blockerCount: 0 }}
        severityCounts={{ blocker: 0, high: 1, medium: 0, low: 0, nit: 0 }}
        categoryStats={[]}
        topIssues={[]}
      />,
    );

    expect(screen.getByText("1 issue in 1 file")).toBeVisible();
    expect(screen.queryByText(/1 issues/)).not.toBeInTheDocument();
    expect(screen.queryByText(/analyzed/i)).not.toBeInTheDocument();
  });

  it("states an empty category summary exactly once", () => {
    render(
      <ReviewCompleteSummary
        stats={{ runId: "run-1", totalIssues: 0, filesWithIssues: 0, blockerCount: 0 }}
        severityCounts={{ blocker: 0, high: 0, medium: 0, low: 0, nit: 0 }}
        categoryStats={[]}
        topIssues={[]}
      />,
    );

    // The full-width span this state renders in is a laid-out box, so the
    // desktop e2e contract owns it; here the sentence only has to be said once.
    expect(screen.getAllByText("Nothing to categorise.")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Issues by category" })).toBeVisible();
  });

  it("tabulates the categories a run did find", () => {
    render(
      <ReviewCompleteSummary
        stats={{ runId: "run-1", totalIssues: 2, filesWithIssues: 1, blockerCount: 0 }}
        severityCounts={{ blocker: 0, high: 0, medium: 2, low: 0, nit: 0 }}
        categoryStats={[{ id: "performance", name: "Performance", count: 2 }]}
        topIssues={[]}
      />,
    );

    expect(screen.getByRole("cell", { name: "Performance" })).toBeVisible();
  });
});
