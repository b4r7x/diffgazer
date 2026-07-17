import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReviewCompleteSummary } from "./review-complete-summary";

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

    expect(screen.getByText("1 issue")).toBeVisible();
    expect(screen.queryByText("1 issues")).not.toBeInTheDocument();
    expect(screen.getByText("1 file with issues")).toBeVisible();
    expect(screen.queryByText(/analyzed/i)).not.toBeInTheDocument();
  });
});
