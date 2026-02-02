import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistoryInsightsPane } from "./history-insights-pane";
import type { TriageIssue } from "@repo/schemas";
import type { SeverityCounts } from "@repo/schemas/ui";

describe("HistoryInsightsPane - Severity Breakdown Section", () => {
  const mockIssues: TriageIssue[] = [
    {
      id: "issue-1",
      title: "Memory leak in useEffect",
      description: "Description 1",
      file: "app.tsx",
      line_start: 42,
      line_end: 45,
      category: "performance",
      severity: "blocker",
      explanation: "Critical memory leak",
    },
    {
      id: "issue-2",
      title: "Unused import statement",
      description: "Description 2",
      file: "utils.ts",
      line_start: 10,
      line_end: 10,
      category: "style",
      severity: "low",
      explanation: "Import is not used",
    },
  ];

  const mockSeverityCounts: SeverityCounts = {
    blocker: 1,
    high: 2,
    medium: 3,
    low: 4,
  };

  const defaultProps = {
    runId: "run-123",
    severityCounts: mockSeverityCounts,
    issues: mockIssues,
    duration: "1m 23s",
  };

  it("renders SEVERITY BREAKDOWN section heading when severityCounts provided", () => {
    render(<HistoryInsightsPane {...defaultProps} />);

    const severityBreakdownHeading = screen.getByText(/severity breakdown/i);
    expect(severityBreakdownHeading).toBeDefined();
  });

  it("does NOT render Severity Breakdown section when severityCounts is null", () => {
    render(<HistoryInsightsPane {...defaultProps} severityCounts={null} />);

    const severityBreakdownHeading = screen.queryByText(/severity breakdown/i);
    expect(severityBreakdownHeading).toBeNull();
  });
});

describe("HistoryInsightsPane - Issues Section", () => {
  const mockIssues: TriageIssue[] = [
    {
      id: "issue-1",
      title: "Memory leak in useEffect",
      description: "Description 1",
      file: "app.tsx",
      line_start: 42,
      line_end: 45,
      category: "performance",
      severity: "blocker",
      explanation: "Critical memory leak",
    },
    {
      id: "issue-2",
      title: "Unused import statement",
      description: "Description 2",
      file: "utils.ts",
      line_start: 10,
      line_end: 10,
      category: "style",
      severity: "low",
      explanation: "Import is not used",
    },
    {
      id: "issue-3",
      title: "Missing error handling",
      description: "Description 3",
      file: "api.ts",
      line_start: 55,
      line_end: 60,
      category: "reliability",
      severity: "high",
      explanation: "Error not handled",
    },
  ];

  const defaultProps = {
    runId: "run-789",
    severityCounts: null,
    issues: mockIssues,
  };

  it("DOES render ISSUES section heading with count", () => {
    render(<HistoryInsightsPane {...defaultProps} />);

    const issuesHeading = screen.getByText(/3 issues/i);
    expect(issuesHeading).toBeDefined();
  });

  it("DOES render all issue titles", () => {
    render(<HistoryInsightsPane {...defaultProps} />);

    const issue1 = screen.getByText("Memory leak in useEffect");
    const issue2 = screen.getByText("Unused import statement");
    const issue3 = screen.getByText("Missing error handling");

    expect(issue1).toBeDefined();
    expect(issue2).toBeDefined();
    expect(issue3).toBeDefined();
  });

  it("DOES render severity labels within issue items", () => {
    render(<HistoryInsightsPane {...defaultProps} />);

    // Severity labels appear in issue items
    const blockerLabel = screen.getByText("[Blocker]");
    const lowLabel = screen.getByText("[Low]");
    const highLabel = screen.getByText("[High]");

    expect(blockerLabel).toBeDefined();
    expect(lowLabel).toBeDefined();
    expect(highLabel).toBeDefined();
  });

  it("DOES render line numbers for issues", () => {
    render(<HistoryInsightsPane {...defaultProps} />);

    const line42 = screen.getByText("L:42");
    const line10 = screen.getByText("L:10");
    const line55 = screen.getByText("L:55");

    expect(line42).toBeDefined();
    expect(line10).toBeDefined();
    expect(line55).toBeDefined();
  });

  it("does not render Issues section when issues is empty", () => {
    render(<HistoryInsightsPane {...defaultProps} issues={[]} />);

    const issuesHeading = screen.queryByText(/\d+ issues/i);
    expect(issuesHeading).toBeNull();
  });

  it("calls onIssueClick when issue is clicked", async () => {
    const onIssueClick = vi.fn();
    const user = userEvent.setup();

    render(
      <HistoryInsightsPane {...defaultProps} onIssueClick={onIssueClick} />,
    );

    const issueTitle = screen.getByText("Memory leak in useEffect");
    await user.click(issueTitle);

    expect(onIssueClick).toHaveBeenCalledTimes(1);
    expect(onIssueClick).toHaveBeenCalledWith("issue-1");
  });

  it("handles click when onIssueClick is undefined", async () => {
    const user = userEvent.setup();

    render(<HistoryInsightsPane {...defaultProps} />);

    const issueTitle = screen.getByText("Memory leak in useEffect");

    // Should not throw error
    await user.click(issueTitle);

    // No error thrown = success
    expect(true).toBe(true);
  });
});

describe("HistoryInsightsPane - Other Functionality", () => {
  it("shows placeholder when runId is null", () => {
    render(
      <HistoryInsightsPane runId={null} severityCounts={null} issues={[]} />,
    );

    const placeholder = screen.getByText("Select a run to view insights");
    expect(placeholder).toBeDefined();
  });

  it("does not render sections when runId is null", () => {
    render(
      <HistoryInsightsPane
        runId={null}
        severityCounts={{ blocker: 1, high: 0, medium: 0, low: 0 }}
        issues={[
          {
            id: "issue-1",
            title: "Test issue",
            description: "Desc",
            file: "test.ts",
            line_start: 1,
            line_end: 1,
            category: "test",
            severity: "blocker",
            explanation: "Exp",
          },
        ]}
      />,
    );

    const severityBreakdownHeading = screen.queryByText(/severity breakdown/i);
    const issuesHeading = screen.queryByText(/\d+ issues/i);

    expect(severityBreakdownHeading).toBeNull();
    expect(issuesHeading).toBeNull();
  });

  it("renders run ID in header when provided", () => {
    render(
      <HistoryInsightsPane runId="abc-123" severityCounts={null} issues={[]} />,
    );

    const header = screen.getByText(/insights: run abc-123/i);
    expect(header).toBeDefined();
  });

  it("renders duration in footer when provided", () => {
    render(
      <HistoryInsightsPane
        runId="run-999"
        severityCounts={null}
        issues={[]}
        duration="2m 45s"
      />,
    );

    const durationLabel = screen.getByText(/duration/i);
    const durationValue = screen.getByText("2m 45s");

    expect(durationLabel).toBeDefined();
    expect(durationValue).toBeDefined();
  });

  it("does not render duration footer when duration is undefined", () => {
    render(
      <HistoryInsightsPane runId="run-999" severityCounts={null} issues={[]} />,
    );

    const durationLabel = screen.queryByText(/duration/i);
    expect(durationLabel).toBeNull();
  });

  it("applies custom className when provided", () => {
    const { container } = render(
      <HistoryInsightsPane
        runId="run-999"
        severityCounts={null}
        issues={[]}
        className="custom-class"
      />,
    );

    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain("custom-class");
  });
});

describe("HistoryInsightsPane - Component Interface", () => {
  it("accepts all required props", () => {
    const props = {
      runId: "test-run",
      severityCounts: null,
      issues: [],
    };

    // Type check: this should compile without errors
    const { container } = render(<HistoryInsightsPane {...props} />);
    expect(container).toBeDefined();
  });

  it("accepts all optional props", () => {
    const props = {
      runId: "test-run",
      severityCounts: { blocker: 1, high: 2, medium: 3, low: 4 },
      issues: [],
      duration: "1m 30s",
      onIssueClick: vi.fn(),
      className: "test-class",
    };

    // Type check: this should compile without errors
    const { container } = render(<HistoryInsightsPane {...props} />);
    expect(container).toBeDefined();
  });
});
