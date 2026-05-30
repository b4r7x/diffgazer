import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { makeIssue } from "@/testing";
import { IssueListPane } from "./issue-list-pane";

const issues = [
  makeIssue({ id: "issue-1", severity: "high", title: "Avoid unsafe cast", file: "src/a.ts", line_start: 1 }),
  makeIssue({ id: "issue-2", severity: "low", title: "Tighten type", file: "src/b.ts", line_start: 2 }),
];

describe("IssueListPane row highlight inversion", () => {
  it("marks the highlighted row with data-active so theming can invert chip colors", () => {
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

    expect(activeRow).toHaveAttribute("data-active", "true");
    expect(inactiveRow).not.toHaveAttribute("data-active", "true");
  });
});
