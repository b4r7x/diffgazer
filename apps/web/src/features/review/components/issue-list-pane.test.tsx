import { makeIssue } from "@diffgazer/core/testing/factories";
import { render, screen } from "@testing-library/react";
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
        listState={{
          issues,
          allIssues: issues,
          selectedIssueId: "issue-1",
          highlightedIssueId: "issue-1",
        }}
        callbacks={{ onSelectIssue: vi.fn() }}
        filter={{ severityFilter: new Set(), onSeverityFilterChange: vi.fn() }}
        refs={{}}
        ui={{ isFocused: true }}
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
        listState={{
          issues,
          allIssues: issues,
          selectedIssueId: "issue-1",
          highlightedIssueId: "issue-1",
        }}
        callbacks={{ onSelectIssue: vi.fn() }}
        filter={{ severityFilter: new Set(), onSeverityFilterChange: vi.fn() }}
        refs={{}}
        ui={{ isFocused: false }}
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
        listState={{ issues, allIssues: issues, selectedIssueId: "issue-1" }}
        callbacks={{ onSelectIssue: vi.fn() }}
        filter={{ severityFilter: new Set(), onSeverityFilterChange: vi.fn() }}
        refs={{}}
        ui={{ isFocused: true }}
      />,
    );

    // Severity reaches AT textually (F-230): high vs low is not color-only.
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
        listState={{
          issues: [issueWithoutLine],
          allIssues: [issueWithoutLine],
          selectedIssueId: issueWithoutLine.id,
        }}
        callbacks={{ onSelectIssue: vi.fn() }}
        filter={{ severityFilter: new Set(), onSeverityFilterChange: vi.fn() }}
        refs={{}}
        ui={{ isFocused: true }}
      />,
    );

    expect(screen.getByText("src/db.ts")).toBeVisible();
    expect(screen.queryByText("src/db.ts:null")).not.toBeInTheDocument();
  });

  it("tags the pane frame with the issue count", () => {
    render(
      <IssueListPane
        listState={{ issues, allIssues: issues, selectedIssueId: null }}
        callbacks={{ onSelectIssue: vi.fn() }}
        filter={{ severityFilter: new Set(), onSeverityFilterChange: vi.fn() }}
        refs={{}}
        ui={{ isFocused: true }}
      />,
    );

    expect(screen.getByText("Issues · 2")).toBeInTheDocument();
  });

  it("shows the no-issues empty state as a live status region", () => {
    render(
      <IssueListPane
        listState={{ issues: [], allIssues: [], selectedIssueId: null }}
        callbacks={{ onSelectIssue: vi.fn() }}
        filter={{ severityFilter: new Set(), onSeverityFilterChange: vi.fn() }}
        refs={{}}
        ui={{ isFocused: true }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("No issues found");
  });

  it("announces the filter-to-empty state as a live status region", () => {
    render(
      <IssueListPane
        listState={{ issues: [], allIssues: issues, selectedIssueId: null }}
        callbacks={{ onSelectIssue: vi.fn() }}
        filter={{ severityFilter: new Set(["nit"]), onSeverityFilterChange: vi.fn() }}
        refs={{}}
        ui={{ isFocused: true }}
      />,
    );

    // F-353(d): the empty message announces on appear, matching the history page.
    expect(screen.getByRole("status")).toHaveTextContent(/no issues match/i);
  });
});
