import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SeverityCounts } from "@diffgazer/core/schemas/presentation";
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
    expect(screen.getByRole("option", { name: /wrong value/i })).toBeInTheDocument();
    expect(screen.getByText("L:7")).toBeInTheDocument();
    expect(screen.getByText("4m 12s")).toBeInTheDocument();
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

    await user.keyboard("{Enter}");

    expect(onSelectIssue).toHaveBeenCalledWith("issue-2");
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

  it("re-anchors the listbox to the first issue when the issues prop changes", () => {
    const { rerender } = render(
      <HistoryInsightsPane
        runId="run-1"
        severityCounts={null}
        issues={issues}
        isFocused

        highlightedIssueId="issue-2"
      />,
    );

    let listbox = screen.getByRole("listbox", { name: /run issues/i });
    expect(listbox).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: /second issue/i }).id,
    );

    const newIssues = [
      makeIssue({ id: "issue-x", severity: "blocker", title: "Brand new", line_start: 5 }),
    ];

    rerender(
      <HistoryInsightsPane
        runId="run-2"
        severityCounts={null}
        issues={newIssues}
        isFocused

        highlightedIssueId="issue-x"
      />,
    );

    listbox = screen.getByRole("listbox", { name: /run issues/i });
    expect(listbox).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: /brand new/i }).id,
    );
  });
});
