import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SeverityCounts } from "@diffgazer/core/schemas/ui";
import { makeIssue } from "@/testing";
import { HistoryInsightsPane } from "./history-insights-pane";

describe("HistoryInsightsPane", () => {
  it("shows an empty placeholder when no run is selected", () => {
    render(
      <HistoryInsightsPane
        runId={null}
        severityCounts={null}
        issues={[]}
      />,
    );
    expect(screen.getByText(/select a run to view insights/i)).toBeInTheDocument();
  });

  it("renders run metadata, severity breakdown, and issue list when a run is selected", () => {
    const counts: SeverityCounts = { blocker: 0, high: 1, medium: 0, low: 0, nit: 0 };
    render(
      <HistoryInsightsPane
        runId="run-42"
        severityCounts={counts}
        issues={[makeIssue({ id: "issue-1", title: "Wrong value", line_start: 7 })]}
        duration="4m 12s"
      />,
    );
    expect(screen.getByText(/run-42/i)).toBeInTheDocument();
    expect(screen.getByText(/severity breakdown/i)).toBeInTheDocument();
    expect(screen.getByText("1 Issues")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /wrong value/i })).toBeInTheDocument();
    expect(screen.getByText("L:7")).toBeInTheDocument();
    expect(screen.getByText("4m 12s")).toBeInTheDocument();
  });

  it("invokes onIssueClick with the issue id when an issue button is clicked", async () => {
    const user = userEvent.setup();
    const onIssueClick = vi.fn();
    render(
      <HistoryInsightsPane
        runId="run-1"
        severityCounts={null}
        issues={[makeIssue({ id: "issue-99", title: "Click me" })]}
        onIssueClick={onIssueClick}
      />,
    );
    await user.click(screen.getByRole("button", { name: /click me/i }));
    expect(onIssueClick).toHaveBeenCalledWith("issue-99");
  });
});
