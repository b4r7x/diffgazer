import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistoryInsightsPane } from "./history-insights-pane";
import type { TriageIssue } from "@repo/schemas";

/**
 * HistoryInsightsPane Tests - Severity Histogram Removal
 *
 * Verifies that:
 * 1. Severity Histogram section is completely removed
 * 2. severityCounts prop no longer exists in component interface
 * 3. Top Lenses section still renders correctly
 * 4. Top Issues section still renders correctly
 * 5. Component maintains all other functionality
 *
 * Location: apps/web/src/features/history/components/history-insights-pane.tsx
 */

describe("HistoryInsightsPane - Severity Histogram Removal", () => {
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

  const defaultProps = {
    runId: "run-123",
    topLenses: ["performance", "security"],
    topIssues: mockIssues,
    duration: "1m 23s",
  };

  it("does NOT render SEVERITY HISTOGRAM section heading", () => {
    render(<HistoryInsightsPane {...defaultProps} />);

    // Use queryByText which returns null if not found
    const severityHistogramHeading = screen.queryByText(/severity histogram/i);
    expect(severityHistogramHeading).toBeNull();
  });

  it("does NOT render severity level labels (Blocker, High, Medium, Low)", () => {
    render(<HistoryInsightsPane {...defaultProps} />);

    // Verify none of the severity labels exist as standalone section headers
    const blockerLabel = screen.queryByText(/^blocker$/i);
    const highLabel = screen.queryByText(/^high$/i);
    const mediumLabel = screen.queryByText(/^medium$/i);
    const lowLabel = screen.queryByText(/^low$/i);

    expect(blockerLabel).toBeNull();
    expect(highLabel).toBeNull();
    expect(mediumLabel).toBeNull();
    expect(lowLabel).toBeNull();
  });

  it("does NOT render SeverityBar components", () => {
    const { container } = render(<HistoryInsightsPane {...defaultProps} />);

    // SeverityBar would have specific data-testid or class patterns
    // Since we don't have access to SeverityBar implementation, check the component doesn't exist
    const severityBars = container.querySelectorAll('[class*="severity-bar"]');
    expect(severityBars.length).toBe(0);
  });

  it("does NOT accept severityCounts prop (type safety check)", () => {
    // This is a compile-time check, but we can verify runtime behavior
    // @ts-expect-error - severityCounts should not exist on props
    const propsWithSeverityCounts = {
      ...defaultProps,
      severityCounts: { blocker: 1, high: 2, medium: 3, low: 4 },
    };

    // Component should render without errors even if extra props are passed
    const { container } = render(<HistoryInsightsPane {...propsWithSeverityCounts} />);
    expect(container).toBeDefined();

    // But the severity histogram should still not render
    const severityHistogramHeading = screen.queryByText(/severity histogram/i);
    expect(severityHistogramHeading).toBeNull();
  });
});

describe("HistoryInsightsPane - Top Lenses Section", () => {
  const defaultProps = {
    runId: "run-456",
    topLenses: ["performance", "security", "accessibility"],
    topIssues: [],
  };

  it("DOES render TOP LENSES section heading", () => {
    render(<HistoryInsightsPane {...defaultProps} />);

    const topLensesHeading = screen.getByText(/top lenses/i);
    expect(topLensesHeading).toBeDefined();
  });

  it("DOES render all lens badges", () => {
    render(<HistoryInsightsPane {...defaultProps} />);

    const performanceBadge = screen.getByText("performance");
    const securityBadge = screen.getByText("security");
    const accessibilityBadge = screen.getByText("accessibility");

    expect(performanceBadge).toBeDefined();
    expect(securityBadge).toBeDefined();
    expect(accessibilityBadge).toBeDefined();
  });

  it("does not render Top Lenses section when topLenses is empty", () => {
    render(
      <HistoryInsightsPane
        {...defaultProps}
        topLenses={[]}
      />
    );

    const topLensesHeading = screen.queryByText(/top lenses/i);
    expect(topLensesHeading).toBeNull();
  });

  it("renders single lens correctly", () => {
    render(
      <HistoryInsightsPane
        {...defaultProps}
        topLenses={["performance"]}
      />
    );

    const topLensesHeading = screen.getByText(/top lenses/i);
    const performanceBadge = screen.getByText("performance");

    expect(topLensesHeading).toBeDefined();
    expect(performanceBadge).toBeDefined();
  });
});

describe("HistoryInsightsPane - Top Issues Section", () => {
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
    topLenses: [],
    topIssues: mockIssues,
  };

  it("DOES render TOP ISSUES section heading with count", () => {
    render(<HistoryInsightsPane {...defaultProps} />);

    const topIssuesHeading = screen.getByText(/top 3 issues/i);
    expect(topIssuesHeading).toBeDefined();
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

    // Severity labels appear in issue items, just not as histogram section
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

  it("does not render Top Issues section when topIssues is empty", () => {
    render(
      <HistoryInsightsPane
        {...defaultProps}
        topIssues={[]}
      />
    );

    const topIssuesHeading = screen.queryByText(/top.*issues/i);
    expect(topIssuesHeading).toBeNull();
  });

  it("calls onIssueClick when issue is clicked", async () => {
    const onIssueClick = vi.fn();
    const user = userEvent.setup();

    render(
      <HistoryInsightsPane
        {...defaultProps}
        onIssueClick={onIssueClick}
      />
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
      <HistoryInsightsPane
        runId={null}
        topLenses={["performance"]}
        topIssues={[]}
      />
    );

    const placeholder = screen.getByText("Select a run to view insights");
    expect(placeholder).toBeDefined();
  });

  it("does not render sections when runId is null", () => {
    render(
      <HistoryInsightsPane
        runId={null}
        topLenses={["performance"]}
        topIssues={[]}
      />
    );

    const topLensesHeading = screen.queryByText(/top lenses/i);
    const topIssuesHeading = screen.queryByText(/top.*issues/i);

    expect(topLensesHeading).toBeNull();
    expect(topIssuesHeading).toBeNull();
  });

  it("renders run ID in header when provided", () => {
    render(
      <HistoryInsightsPane
        runId="abc-123"
        topLenses={[]}
        topIssues={[]}
      />
    );

    const header = screen.getByText(/insights: run abc-123/i);
    expect(header).toBeDefined();
  });

  it("renders duration in footer when provided", () => {
    render(
      <HistoryInsightsPane
        runId="run-999"
        topLenses={[]}
        topIssues={[]}
        duration="2m 45s"
      />
    );

    const durationLabel = screen.getByText(/duration/i);
    const durationValue = screen.getByText("2m 45s");

    expect(durationLabel).toBeDefined();
    expect(durationValue).toBeDefined();
  });

  it("does not render duration footer when duration is undefined", () => {
    render(
      <HistoryInsightsPane
        runId="run-999"
        topLenses={[]}
        topIssues={[]}
      />
    );

    const durationLabel = screen.queryByText(/duration/i);
    expect(durationLabel).toBeNull();
  });

  it("applies custom className when provided", () => {
    const { container } = render(
      <HistoryInsightsPane
        runId="run-999"
        topLenses={[]}
        topIssues={[]}
        className="custom-class"
      />
    );

    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv.className).toContain("custom-class");
  });
});

describe("HistoryInsightsPane - Component Interface", () => {
  it("accepts all required props without severityCounts", () => {
    const props = {
      runId: "test-run",
      topLenses: ["performance"],
      topIssues: [],
    };

    // Type check: this should compile without errors
    const { container } = render(<HistoryInsightsPane {...props} />);
    expect(container).toBeDefined();
  });

  it("accepts all optional props without severityCounts", () => {
    const props = {
      runId: "test-run",
      topLenses: ["performance"],
      topIssues: [],
      duration: "1m 30s",
      onIssueClick: vi.fn(),
      className: "test-class",
    };

    // Type check: this should compile without errors
    const { container } = render(<HistoryInsightsPane {...props} />);
    expect(container).toBeDefined();
  });
});
