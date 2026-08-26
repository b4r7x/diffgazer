import { render, screen, within } from "@testing-library/react";
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

  it("frames a partial run in the warning tone, never success-green", () => {
    render(
      <ReviewCompleteSummary
        stats={{ runId: "run-1", totalIssues: 2, filesWithIssues: 1, blockerCount: 0 }}
        severityCounts={{ blocker: 0, high: 0, medium: 2, low: 0, nit: 0 }}
        categoryStats={[]}
        topIssues={[]}
        lensStats={[
          { lensId: "correctness", issueCount: 2, status: "success" },
          { lensId: "security", issueCount: 0, status: "failed", errorCode: "STREAM_ERROR" },
        ]}
      />,
    );

    // The Panel's rendered tone attribute is the documented contract: the frame
    // must agree with the "Partially Complete" headline instead of painting a
    // pass.
    expect(screen.getByRole("region", { name: "Run status" })).toHaveAttribute(
      "data-tone",
      "warning",
    );
  });

  it("keeps the success frame for a fully reported run", () => {
    render(
      <ReviewCompleteSummary
        stats={{ runId: "run-1", totalIssues: 1, filesWithIssues: 1, blockerCount: 0 }}
        severityCounts={{ blocker: 0, high: 1, medium: 0, low: 0, nit: 0 }}
        categoryStats={[]}
        topIssues={[]}
        lensStats={[{ lensId: "correctness", issueCount: 1, status: "success" }]}
      />,
    );

    expect(screen.getByRole("region", { name: "Run status" })).toHaveAttribute(
      "data-tone",
      "success",
    );
  });

  it("names the run status and top issues panels for assistive tech", () => {
    render(
      <ReviewCompleteSummary
        stats={{ runId: "run-1", totalIssues: 1, filesWithIssues: 1, blockerCount: 0 }}
        severityCounts={{ blocker: 0, high: 1, medium: 0, low: 0, nit: 0 }}
        categoryStats={[]}
        topIssues={[
          {
            id: "1",
            title: "Unchecked response",
            file: "src/api.ts",
            category: "correctness",
            severity: "high",
          },
        ]}
      />,
    );

    expect(screen.getByRole("region", { name: "Run status" })).toBeVisible();
    const preview = screen.getByRole("region", { name: "Top Issues Preview" });
    expect(within(preview).getByText("Unchecked response")).toBeVisible();
  });
});
