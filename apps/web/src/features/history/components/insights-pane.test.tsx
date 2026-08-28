import type { SeverityCounts } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryInsightsPane } from "./insights-pane";

describe("HistoryInsightsPane", () => {
  it("shows an empty placeholder when no run is selected", () => {
    render(<HistoryInsightsPane runId={null} severityCounts={null} issues={[]} />);
    expect(screen.getByText(/select a run to view insights/i)).toBeInTheDocument();
  });

  it("renders severity breakdown and issue list when a run is selected", () => {
    const counts: SeverityCounts = { blocker: 0, high: 1, medium: 0, low: 0, nit: 0 };
    render(
      <HistoryInsightsPane
        runId="run-42"
        severityCounts={counts}
        issues={[makeIssue({ id: "issue-1", title: "Wrong value", line_start: 7 })]}
        duration="4m 12s"
      />,
    );
    expect(screen.getByText(/severity breakdown/i)).toBeInTheDocument();
    expect(screen.getByText("1 Issues")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /wrong value/i })).toBeInTheDocument();
    expect(screen.getByText("index.ts:7")).toBeInTheDocument();
    expect(screen.getByText("4m 12s")).toBeInTheDocument();
  });

  it("states the pass and the run's fact line instead of five zero bars for a clean run", () => {
    const zeros: SeverityCounts = { blocker: 0, high: 0, medium: 0, low: 0, nit: 0 };
    render(
      <HistoryInsightsPane
        runId="run-42"
        severityCounts={zeros}
        cleanRun={{
          statement: "Passed — no issues found",
          factLine: "No issues across 4 files · 2 lenses · 3s",
        }}
        issues={[]}
        duration="3s"
      />,
    );

    expect(screen.getByText("Passed — no issues found")).toBeInTheDocument();
    expect(screen.getByText("No issues across 4 files · 2 lenses · 3s")).toBeInTheDocument();
    expect(screen.queryByText(/severity breakdown/i)).not.toBeInTheDocument();
    // The issues section stays gated as it was, and the duration footer stays.
    expect(screen.queryByRole("listbox", { name: /run issues/i })).not.toBeInTheDocument();
    expect(screen.getByText("3s")).toBeInTheDocument();
  });

  it("keeps the metadata summary visible while review details load", () => {
    const counts: SeverityCounts = { blocker: 0, high: 1, medium: 0, low: 0, nit: 0 };
    render(
      <HistoryInsightsPane
        runId="run-42"
        severityCounts={counts}
        issues={[]}
        detailState={{ status: "loading" }}
      />,
    );

    expect(screen.getByText(/severity breakdown/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading review details...");
  });

  it("shows a retryable detail error without discarding the metadata summary", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const counts: SeverityCounts = { blocker: 0, high: 1, medium: 0, low: 0, nit: 0 };
    render(
      <HistoryInsightsPane
        runId="run-42"
        severityCounts={counts}
        issues={[]}
        detailState={{ status: "error", message: "disk unreadable", retry: onRetry }}
      />,
    );

    expect(screen.getByText(/severity breakdown/i)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("disk unreadable");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("keeps the location out of the issue label and on its own row", () => {
    render(
      <HistoryInsightsPane
        runId="run-1"
        severityCounts={null}
        issues={[
          makeIssue({
            id: "issue-1",
            severity: "medium",
            title: "Missing coverage for server state",
            file: "src/components/layout/header.tsx",
            line_start: 70,
          }),
        ]}
      />,
    );

    // Column alignment is CSS, which jsdom does not compute; what is assertable
    // is the structure it rests on — the severity tag and title form the row's
    // label, the location is a separate described-by row after them.
    const option = screen.getByRole("option");
    expect(option).toHaveAccessibleName(/^\[Medium\]\s*Missing coverage for server state$/);
    expect(option).toHaveAccessibleDescription("header.tsx:70");
    expect(option).toHaveTextContent(
      /\[Medium\]\s*Missing coverage for server state\s*header\.tsx:70/,
    );
  });

  it("lays the row out as glyph, severity, title, then location", () => {
    render(
      <HistoryInsightsPane
        runId="run-1"
        severityCounts={null}
        issues={[
          makeIssue({
            id: "issue-1",
            severity: "medium",
            title: "Missing coverage for server state",
            file: "src/components/layout/header.tsx",
            line_start: 70,
          }),
        ]}
      />,
    );

    // The title element spreads its children into the row grid, so the grid's
    // first track is filled by the glyph the list's indicator renders, not by
    // anything this pane writes. Flatten the title away to read the real order.
    const option = screen.getByRole("option");
    const labelId = option.getAttribute("aria-labelledby");
    const title = labelId === null ? null : document.getElementById(labelId);
    const grid = title?.parentElement ?? null;
    expect(grid).not.toBeNull();

    const tracks = Array.from(grid?.children ?? []).flatMap((child) =>
      child === title ? Array.from(child.children) : [child],
    );

    expect(tracks.map((element) => element.textContent)).toEqual([
      "\u258C",
      "[Medium]",
      "Missing coverage for server state",
      "header.tsx:70",
    ]);
  });

  it("falls back to the file name when a run issue has no line location", () => {
    render(
      <HistoryInsightsPane
        runId="run-1"
        severityCounts={null}
        issues={[
          makeIssue({
            id: "issue-without-line",
            title: "Missing line location",
            line_start: null,
            line_end: null,
          }),
        ]}
      />,
    );

    expect(screen.getByRole("option", { name: /missing line location/i })).toBeInTheDocument();
    expect(screen.getByText("index.ts")).toBeInTheDocument();
    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
  });

  it("invokes onSelectIssue with the issue id when an issue is clicked", async () => {
    const user = userEvent.setup();
    const onSelectIssue = vi.fn();
    render(
      <HistoryInsightsPane
        runId="run-1"
        severityCounts={null}
        issues={[makeIssue({ id: "issue-99", title: "Click me" })]}
        isFocused
        onSelectIssue={onSelectIssue}
      />,
    );
    await user.click(screen.getByRole("option", { name: /click me/i }));
    expect(onSelectIssue).toHaveBeenCalledOnce();
    expect(onSelectIssue).toHaveBeenCalledWith("issue-99");
  });
});

describe("HistoryInsightsPane keyboard navigation", () => {
  const issues = [
    makeIssue({ id: "issue-1", severity: "high", title: "First issue", line_start: 1 }),
    makeIssue({ id: "issue-2", severity: "medium", title: "Second issue", line_start: 2 }),
    makeIssue({ id: "issue-3", severity: "low", title: "Third issue", line_start: 3 }),
  ];

  let scrollSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollSpy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: scrollSpy,
    });
  });

  afterEach(() => {
    delete (HTMLElement.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it("places the listbox in the tab order so focus lands on the container, not the first issue", () => {
    render(
      <HistoryInsightsPane
        runId="run-1"
        severityCounts={null}
        issues={issues}
        isFocused
        highlightedIssueId="issue-1"
      />,
    );

    const listbox = screen.getByRole("listbox", { name: /run issues/i });
    expect(listbox).toHaveAttribute("tabindex", "0");
  });

  it("exposes aria-activedescendant pointing at the highlighted issue", () => {
    render(
      <HistoryInsightsPane
        runId="run-1"
        severityCounts={null}
        issues={issues}
        isFocused
        highlightedIssueId="issue-1"
      />,
    );

    const listbox = screen.getByRole("listbox", { name: /run issues/i });
    const firstOption = screen.getByRole("option", { name: /first issue/i });

    expect(listbox).toHaveAttribute("aria-activedescendant", firstOption.id);
  });

  it("moves the highlight down with ArrowDown", async () => {
    const user = userEvent.setup();
    const onHighlight = vi.fn();
    render(
      <HistoryInsightsPane
        runId="run-1"
        severityCounts={null}
        issues={issues}
        isFocused
        highlightedIssueId="issue-1"
        onHighlightIssue={onHighlight}
      />,
    );

    const listbox = screen.getByRole("listbox", { name: /run issues/i });
    listbox.focus();

    await user.keyboard("{ArrowDown}");
    expect(onHighlight).toHaveBeenLastCalledWith("issue-2");
  });

  it("moves the highlight up with ArrowUp", async () => {
    const user = userEvent.setup();
    const onHighlight = vi.fn();
    render(
      <HistoryInsightsPane
        runId="run-1"
        severityCounts={null}
        issues={issues}
        isFocused
        highlightedIssueId="issue-2"
        onHighlightIssue={onHighlight}
      />,
    );

    const listbox = screen.getByRole("listbox", { name: /run issues/i });
    listbox.focus();

    await user.keyboard("{ArrowUp}");
    expect(onHighlight).toHaveBeenLastCalledWith("issue-1");
  });

  it("supports Home and End to jump to first and last", async () => {
    const user = userEvent.setup();
    const onHighlight = vi.fn();
    const { rerender } = render(
      <HistoryInsightsPane
        runId="run-1"
        severityCounts={null}
        issues={issues}
        isFocused
        highlightedIssueId="issue-2"
        onHighlightIssue={onHighlight}
      />,
    );

    const listbox = screen.getByRole("listbox", { name: /run issues/i });
    listbox.focus();

    await user.keyboard("{End}");
    expect(onHighlight).toHaveBeenLastCalledWith("issue-3");

    rerender(
      <HistoryInsightsPane
        runId="run-1"
        severityCounts={null}
        issues={issues}
        isFocused
        highlightedIssueId="issue-3"
        onHighlightIssue={onHighlight}
      />,
    );

    await user.keyboard("{Home}");
    expect(onHighlight).toHaveBeenLastCalledWith("issue-1");
  });

  it("clamps the highlight at the last issue and reports the boundary instead of wrapping", async () => {
    const user = userEvent.setup();
    const onBoundary = vi.fn();
    render(
      <HistoryInsightsPane
        runId="run-1"
        severityCounts={null}
        issues={issues}
        isFocused
        highlightedIssueId="issue-3"
        onListBoundaryReached={onBoundary}
      />,
    );

    const listbox = screen.getByRole("listbox", { name: /run issues/i });
    listbox.focus();

    await user.keyboard("{ArrowDown}");
    expect(onBoundary).toHaveBeenCalledWith("next");
  });

  it("calls scrollIntoView when the highlight moves so overflowing items become visible", async () => {
    const user = userEvent.setup();
    render(
      <HistoryInsightsPane
        runId="run-1"
        severityCounts={null}
        issues={issues}
        isFocused
        highlightedIssueId="issue-1"
        onHighlightIssue={vi.fn()}
      />,
    );

    const listbox = screen.getByRole("listbox", { name: /run issues/i });
    listbox.focus();

    await user.keyboard("{ArrowDown}");

    expect(scrollSpy).toHaveBeenCalled();
  });

  it("activates the highlighted issue when Enter is pressed", async () => {
    const user = userEvent.setup();
    const onSelectIssue = vi.fn();
    render(
      <HistoryInsightsPane
        runId="run-1"
        severityCounts={null}
        issues={issues}
        isFocused
        highlightedIssueId="issue-2"
        onSelectIssue={onSelectIssue}
      />,
    );

    const listbox = screen.getByRole("listbox", { name: /run issues/i });
    listbox.focus();

    await user.keyboard("{Enter}{Enter}");

    expect(onSelectIssue).toHaveBeenCalledTimes(2);
    expect(onSelectIssue).toHaveBeenNthCalledWith(1, "issue-2");
    expect(onSelectIssue).toHaveBeenNthCalledWith(2, "issue-2");
  });

  it("does not include severity-breakdown bars in the listbox option set", () => {
    const counts: SeverityCounts = { blocker: 1, high: 1, medium: 1, low: 1, nit: 1 };
    render(
      <HistoryInsightsPane
        runId="run-1"
        severityCounts={counts}
        issues={issues}
        isFocused
        highlightedIssueId="issue-1"
      />,
    );

    const listbox = screen.getByRole("listbox", { name: /run issues/i });
    const options = within(listbox).getAllByRole("option");
    expect(options).toHaveLength(issues.length);
  });
});
