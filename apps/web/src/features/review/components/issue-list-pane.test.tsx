import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IssueDetailsPane } from "./issue-details-pane/pane";
import { IssueListPane } from "./issue-list-pane";

/**
 * Matches the row's location line by the text it shows. PathValue splits the
 * path across a truncating head span and a tail span, so the line is the
 * innermost element carrying the whole location — its ancestors repeat that
 * text and are dropped here.
 */
function locationLine(issue: ReviewIssue) {
  const location = `${issue.file}:${issue.line_start}`;
  return (_content: string, element: Element | null) =>
    element?.textContent === location &&
    Array.from(element.children).every((child) => child.textContent !== location);
}

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
        runDisplayId="#review-1"
        selectedIssueId="issue-1"
        highlightedIssueId="issue-1"
        onSelectIssue={vi.fn()}
        filter={{ activeFilter: new Set(), onFilterChange: vi.fn() }}
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
        runDisplayId="#review-1"
        selectedIssueId="issue-1"
        highlightedIssueId="issue-1"
        onSelectIssue={vi.fn()}
        filter={{ activeFilter: new Set(), onFilterChange: vi.fn() }}
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
        runDisplayId="#review-1"
        selectedIssueId="issue-1"
        onSelectIssue={vi.fn()}
        filter={{ activeFilter: new Set(), onFilterChange: vi.fn() }}
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
        runDisplayId="#review-1"
        selectedIssueId={issueWithoutLine.id}
        onSelectIssue={vi.fn()}
        filter={{ activeFilter: new Set(), onFilterChange: vi.fn() }}
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
        runDisplayId="#review-1"
        selectedIssueId={null}
        onSelectIssue={vi.fn()}
        filter={{ activeFilter: new Set(), onFilterChange: vi.fn() }}
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
        runDisplayId="#review-1"
        selectedIssueId={null}
        onSelectIssue={vi.fn()}
        filter={{ activeFilter: new Set(), onFilterChange: vi.fn() }}
        isFocused
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("No issues found");
  });

  it("announces the filter-to-empty state as a live status region", () => {
    const onSelectIssue = vi.fn();
    const onFilterChange = vi.fn();
    const { rerender } = render(
      <IssueListPane
        issues={issues}
        allIssues={issues}
        runDisplayId="#review-1"
        selectedIssueId={null}
        onSelectIssue={onSelectIssue}
        filter={{ activeFilter: new Set(), onFilterChange }}
        isFocused
      />,
    );
    const liveRegion = screen.getByRole("status");

    expect(liveRegion).toHaveTextContent("");

    rerender(
      <IssueListPane
        issues={[]}
        allIssues={issues}
        runDisplayId="#review-1"
        selectedIssueId={null}
        onSelectIssue={onSelectIssue}
        filter={{ activeFilter: new Set(["nit"]), onFilterChange }}
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
        runDisplayId="#review-1"
        selectedIssueId="issue-1"
        onSelectIssue={vi.fn()}
        filter={{ activeFilter: new Set(), onFilterChange: vi.fn() }}
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

  it("draws a severity glyph beside the title without dropping the severity word", () => {
    const graded = [
      { severity: "blocker", glyph: "✱", label: "BLOCKER" },
      { severity: "high", glyph: "▲", label: "HIGH" },
      { severity: "medium", glyph: "●", label: "MED" },
      { severity: "low", glyph: "○", label: "LOW" },
      { severity: "nit", glyph: "○", label: "NIT" },
    ] as const;
    const gradedIssues = graded.map(({ severity }, index) =>
      makeIssue({
        id: `issue-${severity}`,
        severity,
        title: `${severity} finding`,
        file: "src/a.ts",
        line_start: index + 1,
      }),
    );

    render(
      <IssueListPane
        issues={gradedIssues}
        allIssues={gradedIssues}
        runDisplayId="#review-1"
        selectedIssueId={null}
        onSelectIssue={vi.fn()}
        filter={{ activeFilter: new Set(), onFilterChange: vi.fn() }}
        isFocused
      />,
    );

    for (const { severity, glyph, label } of graded) {
      const row = screen.getByRole("option", { name: new RegExp(`${severity} finding$`) });
      expect(within(row).getByText(glyph)).toBeVisible();
      expect(within(row).getByText(label)).toBeVisible();
    }
  });

  it("keeps every row on the same line inventory so the desktop pitch is uniform", () => {
    // jsdom computes no layout, so uniform row height is asserted as uniform
    // structure: one title line plus one location line per row, whatever the
    // title length. The clamp holding the title to that single line at >=768px
    // is a rendered-layout fact and belongs to the desktop e2e contract.
    const uneven = [
      makeIssue({
        id: "issue-long",
        severity: "medium",
        title: "A finding whose title is long enough to wrap onto a second line in a narrow pane",
        file: "src/very/deep/nested/module.ts",
        line_start: 120,
      }),
      makeIssue({ id: "issue-short", severity: "nit", title: "Short", file: "src/a.ts" }),
    ];

    render(
      <IssueListPane
        issues={uneven}
        allIssues={uneven}
        runDisplayId="#review-1"
        selectedIssueId={null}
        onSelectIssue={vi.fn()}
        filter={{ activeFilter: new Set(), onFilterChange: vi.fn() }}
        isFocused
      />,
    );

    for (const issue of uneven) {
      const row = screen.getByRole("option", { name: new RegExp(`${issue.title}$`) });
      expect(within(row).getByText(issue.title)).toBeVisible();
      expect(within(row).getAllByText(locationLine(issue))).toHaveLength(1);
    }
  });

  it("keeps a zero-count filter chip labelled and operable", () => {
    renderPane();

    const blocker = screen.getByRole("button", { name: "BLOCKER severity, 0 issues" });
    expect(blocker).toBeEnabled();
    expect(blocker).toHaveAttribute("aria-pressed", "false");
  });
});

describe("Review pane chrome", () => {
  function renderPanes() {
    render(
      <>
        <IssueListPane
          issues={issues}
          allIssues={issues}
          runDisplayId="#review-1"
          selectedIssueId="issue-1"
          onSelectIssue={vi.fn()}
          filter={{ activeFilter: new Set(), onFilterChange: vi.fn() }}
          isFocused={false}
        />
        <IssueDetailsPane
          issue={issues[0] ?? null}
          activeTab="details"
          onTabChange={vi.fn()}
          completedSteps={new Set<number>()}
          onToggleStep={vi.fn()}
        />
      </>,
    );

    return {
      listPane: screen.getByRole("complementary", { name: "Issue list" }),
      detailsPane: screen.getByRole("complementary", { name: "Issue details" }),
    };
  }

  it("rests both panes in the same chrome until focus enters one of them", () => {
    const { listPane, detailsPane } = renderPanes();

    expect(listPane).not.toHaveAttribute("data-state", "focused");
    expect(detailsPane).not.toHaveAttribute("data-state", "focused");
    expect(listPane.getAttribute("data-frame")).toBe(detailsPane.getAttribute("data-frame"));
  });

  it("moves the focused chrome between the panes as focus moves", async () => {
    const user = userEvent.setup();
    const { listPane, detailsPane } = renderPanes();

    await user.click(screen.getByRole("button", { name: "BLOCKER severity, 0 issues" }));

    expect(listPane).toHaveAttribute("data-state", "focused");
    expect(detailsPane).not.toHaveAttribute("data-state", "focused");

    await user.click(screen.getByRole("tab", { name: "Details" }));

    expect(detailsPane).toHaveAttribute("data-state", "focused");
    expect(listPane).not.toHaveAttribute("data-state", "focused");
  });
});
