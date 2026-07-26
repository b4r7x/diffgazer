import { makeIssue } from "@diffgazer/core/testing/factories";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IssueListPane } from "./issue-list-pane";

const issues = [
  makeIssue({
    id: "issue-1",
    severity: "high",
    title: "Avoid unsafe cast",
    file: "src/a.ts",
    line_start: 1,
  }),
  makeIssue({
    id: "issue-2",
    severity: "low",
    title: "Tighten type",
    file: "src/b.ts",
    line_start: 2,
  }),
];

describe("IssueListPane row highlight inversion", () => {
  it("marks the highlighted row with data-highlighted so theming can invert chip colors", () => {
    render(
      <IssueListPane
        issues={issues}
        allIssues={issues}
        selectedIssueId="issue-1"
        highlightedIssueId="issue-1"
        onSelectIssue={vi.fn()}
        severityFilter={new Set()}
        onSeverityFilterChange={vi.fn()}
        isFocused
      />,
    );

    const activeRow = screen.getByRole("option", { name: /avoid unsafe cast/i });
    const inactiveRow = screen.getByRole("option", { name: /tighten type/i });

    expect(activeRow).toHaveAttribute("data-highlighted");
    expect(inactiveRow).not.toHaveAttribute("data-highlighted");
  });

  it("keeps the selected row marked as selected when focus moves to another pane", () => {
    render(
      <IssueListPane
        issues={issues}
        allIssues={issues}
        selectedIssueId="issue-1"
        highlightedIssueId="issue-1"
        onSelectIssue={vi.fn()}
        severityFilter={new Set()}
        onSeverityFilterChange={vi.fn()}
        isFocused={false}
      />,
    );

    const selectedRow = screen.getByRole("option", { name: /avoid unsafe cast/i });
    expect(selectedRow).toHaveAttribute("aria-selected", "true");
    expect(selectedRow).toHaveAttribute("data-selected");
    expect(selectedRow).not.toHaveAttribute("data-highlighted");
  });
});

describe("IssueListPane severity accessibility", () => {
  it("exposes each issue's severity word in its accessible name, not just by color", () => {
    render(
      <IssueListPane
        issues={issues}
        allIssues={issues}
        selectedIssueId="issue-1"
        onSelectIssue={vi.fn()}
        severityFilter={new Set()}
        onSeverityFilterChange={vi.fn()}
        isFocused
      />,
    );

    // Severity reaches AT textually: high vs low is not color-only.
    expect(screen.getByRole("option", { name: /high severity.*avoid unsafe cast/i })).toBeVisible();
    expect(screen.getByRole("option", { name: /low severity.*tighten type/i })).toBeVisible();
  });

  it("does not render a nullable line as part of the issue location", () => {
    const issueWithoutLine = makeIssue({
      id: "issue-without-line",
      title: "Missing line location",
      file: "src/db.ts",
      line_start: null,
      line_end: null,
    });

    render(
      <IssueListPane
        issues={[issueWithoutLine]}
        allIssues={[issueWithoutLine]}
        selectedIssueId={issueWithoutLine.id}
        onSelectIssue={vi.fn()}
        severityFilter={new Set()}
        onSeverityFilterChange={vi.fn()}
        isFocused
      />,
    );

    // The location renders through PathValue, which splits the directory off
    // the filename; the tooltip carries the whole path.
    expect(screen.getByTitle("src/db.ts")).toBeVisible();
    expect(screen.queryByText("src/db.ts:null")).not.toBeInTheDocument();
  });

  it("tags the pane frame with the issue count", () => {
    render(
      <IssueListPane
        issues={issues}
        allIssues={issues}
        selectedIssueId={null}
        onSelectIssue={vi.fn()}
        severityFilter={new Set()}
        onSeverityFilterChange={vi.fn()}
        isFocused
      />,
    );

    expect(screen.getByText("Issues · 2")).toBeInTheDocument();
  });

  it("shows the no-issues empty state as a live status region", () => {
    render(
      <IssueListPane
        issues={[]}
        allIssues={[]}
        selectedIssueId={null}
        onSelectIssue={vi.fn()}
        severityFilter={new Set()}
        onSeverityFilterChange={vi.fn()}
        isFocused
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("No issues found");
  });

  it("announces the filter-to-empty state as a live status region", () => {
    const onSelectIssue = vi.fn();
    const onSeverityFilterChange = vi.fn();
    const { rerender } = render(
      <IssueListPane
        issues={issues}
        allIssues={issues}
        selectedIssueId={null}
        onSelectIssue={onSelectIssue}
        severityFilter={new Set()}
        onSeverityFilterChange={onSeverityFilterChange}
        isFocused
      />,
    );
    const liveRegion = screen.getByRole("status");

    expect(liveRegion).toHaveTextContent("");

    rerender(
      <IssueListPane
        issues={[]}
        allIssues={issues}
        selectedIssueId={null}
        onSelectIssue={onSelectIssue}
        severityFilter={new Set(["nit"])}
        onSeverityFilterChange={onSeverityFilterChange}
        isFocused
      />,
    );

    expect(screen.getByRole("status")).toBe(liveRegion);
    expect(liveRegion).toHaveTextContent(/no issues match/i);
  });
});

describe("IssueListPane severity", () => {
  function renderPane() {
    return render(
      <IssueListPane
        issues={issues}
        allIssues={issues}
        selectedIssueId="issue-1"
        onSelectIssue={vi.fn()}
        severityFilter={new Set()}
        onSeverityFilterChange={vi.fn()}
        isFocused
      />,
    );
  }

  it("prints the severity as a word on every row", () => {
    renderPane();

    const row = screen.getByRole("option", { name: /avoid unsafe cast/i });
    expect(within(row).getByText("HIGH")).toBeVisible();
    expect(
      within(screen.getByRole("option", { name: /tighten type/i })).getByText("LOW"),
    ).toBeVisible();
  });

  it("announces the severity exactly once per row", () => {
    renderPane();

    expect(
      screen.getByRole("option", { name: /^high severity:\s*Avoid unsafe cast$/ }),
    ).toBeVisible();
    expect(screen.getByRole("option", { name: /^low severity:\s*Tighten type$/ })).toBeVisible();
  });

  it("keeps a gutter between a full-width title and the severity tag", () => {
    // Public styling contract exception: the row grid has no column gap and
    // jsdom computes no layout, so the padding class is the only observable
    // form of "these two cells never touch".
    renderPane();

    const row = screen.getByRole("option", { name: /avoid unsafe cast/i });
    const title = within(row).getByText("Avoid unsafe cast").parentElement;

    expect(title?.className).toContain("pe-3");
  });

  it("keeps a zero-count filter chip labelled and operable", () => {
    renderPane();

    const blocker = screen.getByRole("button", { name: "BLOCKER severity, 0 issues" });
    expect(blocker).toBeEnabled();
    expect(blocker).toHaveAttribute("aria-pressed", "false");
  });
});
