import { FooterProvider } from "@diffgazer/core/footer";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FooterView } from "@/testing/footer-view";
import { expectSingleReticle } from "@/testing/reticle";
import { ReviewSummaryView } from "./summary-view";

function renderSummary(props?: {
  droppedBelowThreshold?: number;
  droppedDuplicates?: number;
  minSeverity?: ReviewIssue["severity"];
  lensStats?: LensStat[];
  issues?: ReviewIssue[];
  reviewId?: string | null;
  durationMs?: number;
  onBack?: () => void;
}) {
  return render(
    <KeyboardProvider>
      <FooterProvider>
        <ReviewSummaryView
          issues={props?.issues ?? [makeIssue({ id: "1", severity: "high", title: "Issue 1" })]}
          reviewId={props?.reviewId === undefined ? "review-1" : props.reviewId}
          durationMs={props?.durationMs}
          droppedBelowThreshold={props?.droppedBelowThreshold}
          droppedDuplicates={props?.droppedDuplicates}
          minSeverity={props?.minSeverity}
          lensStats={props?.lensStats}
          onEnterReview={vi.fn()}
          onBack={props?.onBack ?? vi.fn()}
        />
        <FooterView />
      </FooterProvider>
    </KeyboardProvider>,
  );
}

describe("ReviewSummaryView", () => {
  it("shortens the run id in the heading", () => {
    renderSummary({ reviewId: "7685a1b2-0000-4000-8000-000000000000" });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Review Complete #7685");
    expect(screen.getByRole("region", { name: "Top Issues Preview" })).toBeVisible();
  });

  it("names both summary regions so assistive tech can reach them", () => {
    renderSummary();

    expect(screen.getByRole("region", { name: "Severity breakdown" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Issues by category" })).toBeVisible();
  });

  it("states the run as one fact line instead of a filled-in template", () => {
    renderSummary({
      durationMs: 134_000,
      issues: [
        makeIssue({ id: "1", severity: "high", title: "Issue 1", file: "a.ts" }),
        makeIssue({ id: "2", severity: "low", title: "Issue 2", file: "b.ts" }),
      ],
    });

    expect(screen.getByText("2 issues in 2 files · 2m 14s")).toBeVisible();
    expect(screen.queryByText(/^Duration:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Found .* across/)).not.toBeInTheDocument();
  });

  it("says a clean run found nothing and drops the empty category table", () => {
    renderSummary({ issues: [], durationMs: 3800 });

    expect(screen.getByText("No issues found · 3.8s")).toBeVisible();
    const categories = screen.getByRole("region", { name: "Issues by category" });
    expect(within(categories).getByText("Nothing to categorise.")).toBeVisible();
    expect(within(categories).queryByRole("table")).not.toBeInTheDocument();
  });

  it("falls back to #unknown in the heading when the review id is missing", () => {
    renderSummary({ reviewId: null });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Review Complete #unknown");
  });

  it("renders the persisted review duration in the fact line", () => {
    renderSummary({ durationMs: 2500 });

    expect(screen.getByText("1 issue in 1 file · 2.5s")).toBeVisible();
  });

  it("renders category names in the stats table without literal icon words", () => {
    renderSummary({
      issues: [
        makeIssue({ id: "1", category: "security", title: "Security issue" }),
        makeIssue({ id: "2", category: "performance", title: "Performance issue" }),
      ],
    });

    expect(screen.getByText("Security")).toBeInTheDocument();
    expect(screen.getByText("Performance")).toBeInTheDocument();
    expect(screen.queryByText("shield")).not.toBeInTheDocument();
    expect(screen.queryByText("zap")).not.toBeInTheDocument();
    expect(screen.queryByText("code")).not.toBeInTheDocument();
  });

  it("renders the hidden-count notice naming the severity threshold", () => {
    renderSummary({ droppedBelowThreshold: 3, minSeverity: "low" });

    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("3 below-threshold issues hidden (threshold: low)");
  });

  it("explains the issue-count reduction caused by cross-lens duplicates", () => {
    renderSummary({
      droppedDuplicates: 1,
      lensStats: [
        { lensId: "correctness", issueCount: 1, status: "success" },
        { lensId: "security", issueCount: 1, status: "success" },
      ],
    });

    expect(screen.getByRole("note")).toHaveTextContent(
      "1 duplicate issue collapsed across lenses (2 → 1 issue)",
    );
    const lensTable = screen.getByRole("table", { name: /issues by lens/i });
    expect(within(lensTable).getAllByText("1")).toHaveLength(2);
  });

  it("renders the per-lens stats table including a failed lens error code", () => {
    renderSummary({
      lensStats: [
        { lensId: "correctness", issueCount: 2, status: "success" },
        { lensId: "security", issueCount: 0, status: "failed", errorCode: "CANCELLED" },
      ],
    });

    const table = screen.getByRole("table", { name: /issues by lens/i });
    expect(within(table).getByRole("columnheader", { name: "Lens" })).toHaveAttribute(
      "scope",
      "col",
    );
    expect(within(table).getByRole("columnheader", { name: "Issues" })).toHaveAttribute(
      "scope",
      "col",
    );
    expect(within(table).getByRole("rowheader", { name: "Correctness" })).toHaveAttribute(
      "scope",
      "row",
    );
    expect(within(table).getByText("2")).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "Security" })).toHaveAttribute(
      "scope",
      "row",
    );
    expect(within(table).getByText("failed [CANCELLED]")).toBeInTheDocument();
  });

  it("omits the hidden-count notice when nothing was dropped", () => {
    renderSummary();

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("does not fabricate a top-issue line number when no line is reported", () => {
    renderSummary({
      issues: [
        makeIssue({
          id: "1",
          title: "Unknown line issue",
          file: "src/db.ts",
          line_start: null,
          line_end: null,
        }),
      ],
    });

    // The location renders through PathValue, which splits the directory off
    // the filename; the tooltip carries the whole path.
    expect(screen.getByTitle("src/db.ts")).toBeInTheDocument();
    expect(screen.queryByText("src/db.ts:0")).not.toBeInTheDocument();
  });

  it("exposes a visible Back control that leaves the summary like Escape does", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    renderSummary({ onBack });

    // Escape alone left the summary with no pointer-reachable exit.
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);

    await user.keyboard("{Escape}");
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it("focuses and highlights [View Results] on mount instead of the summary region", async () => {
    renderSummary();

    const viewResults = screen.getByRole("button", { name: /view results/i });
    await waitFor(() => expect(viewResults).toHaveFocus());
    expect(viewResults).toHaveAttribute("data-highlighted");
    expect(screen.getByRole("region", { name: "Review summary" })).not.toHaveFocus();
  });

  it("keeps one reticle whether the action row or the summary region holds focus", async () => {
    const user = userEvent.setup();
    const { container } = renderSummary();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /view results/i })).toHaveFocus(),
    );
    expectSingleReticle(container);

    await user.keyboard("{ArrowUp}");
    const region = screen.getByRole("region", { name: "Review summary" });
    expect(region).toHaveFocus();
    // The scroller keeps keyboard scrolling but defers the pane mark to the
    // Panel: the defusal class is libs/ui's documented outline contract.
    expect(region).toHaveClass("focus:outline-none");
    expectSingleReticle(container);
  });

  it("moves focus and highlight between the actions with arrow keys", async () => {
    const user = userEvent.setup();
    renderSummary();
    const viewResults = screen.getByRole("button", { name: /view results/i });
    const back = screen.getByRole("button", { name: "Back" });
    await waitFor(() => expect(viewResults).toHaveFocus());

    await user.keyboard("{ArrowLeft}");
    expect(back).toHaveFocus();
    expect(back).toHaveAttribute("data-highlighted");
    expect(viewResults).not.toHaveAttribute("data-highlighted");

    await user.keyboard("{ArrowRight}");
    expect(viewResults).toHaveFocus();
    expect(viewResults).toHaveAttribute("data-highlighted");
    expect(back).not.toHaveAttribute("data-highlighted");
  });

  it("drops the action highlight when Shift+Tab moves focus to the summary region", async () => {
    const user = userEvent.setup();
    const { container } = renderSummary();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /view results/i })).toHaveFocus(),
    );

    await user.tab({ shift: true });
    const back = screen.getByRole("button", { name: "Back" });
    expect(back).toHaveFocus();

    await user.tab({ shift: true });
    // The region wears no ring of its own, so a mark left on [← Back] would be
    // the only control mark on screen - on a button that does not have focus.
    expect(screen.getByRole("region", { name: "Review summary" })).toHaveFocus();
    expect(back).not.toHaveAttribute("data-highlighted");
    expect(screen.getByRole("button", { name: /view results/i })).not.toHaveAttribute(
      "data-highlighted",
    );
    expectSingleReticle(container);
  });

  it("enters the summary region with ArrowUp and returns to the actions with ArrowDown", async () => {
    const user = userEvent.setup();
    renderSummary();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /view results/i })).toHaveFocus(),
    );

    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("region", { name: "Review summary" })).toHaveFocus();

    // Nothing to scroll here (jsdom has no layout), so ↓ is a pure zone move; the
    // overflowing case is pinned below.
    await user.keyboard("{ArrowDown}");
    const back = screen.getByRole("button", { name: "Back" });
    expect(back).toHaveFocus();
    expect(back).toHaveAttribute("data-highlighted");
  });

  it("returns to the actions when ArrowDown reaches the bottom of an overflowing summary", async () => {
    const user = userEvent.setup();
    renderSummary();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /view results/i })).toHaveFocus(),
    );
    const region = screen.getByRole("region", { name: "Review summary" });
    // jsdom has no layout; pin the metrics that make the region overflow.
    Object.defineProperty(region, "clientHeight", { value: 100, configurable: true });
    Object.defineProperty(region, "scrollHeight", { value: 1000, configurable: true });

    await user.keyboard("{ArrowUp}");
    await user.keyboard("{ArrowDown}");
    // Content below still owns ↓.
    expect(region).toHaveFocus();
    expect(region.scrollTop).toBe(40);

    await user.keyboard("{End}");
    await user.keyboard("{ArrowDown}");
    const back = screen.getByRole("button", { name: "Back" });
    expect(back).toHaveFocus();
    expect(back).toHaveAttribute("data-highlighted");
  });

  it("names the keys of the zone that holds focus in the footer", async () => {
    const user = userEvent.setup();
    renderSummary();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /view results/i })).toHaveFocus(),
    );
    const legend = screen.getByRole("contentinfo");

    expect(within(legend).getByText("Move Action")).toBeInTheDocument();

    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("region", { name: "Review summary" })).toHaveFocus();

    // ←/→ does nothing inside the region; the keys that do work there are named.
    expect(await within(legend).findByText("Scroll")).toBeInTheDocument();
    expect(within(legend).getByText("Actions")).toBeInTheDocument();
    expect(within(legend).queryByText("Move Action")).not.toBeInTheDocument();
  });

  it("scrolls the summary region with arrow and page keys after ArrowUp focuses it", async () => {
    const user = userEvent.setup();
    renderSummary();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /view results/i })).toHaveFocus(),
    );
    const region = screen.getByRole("region", { name: "Review summary" });
    // jsdom has no layout; pin the metrics that make the region overflow.
    Object.defineProperty(region, "clientHeight", { value: 100, configurable: true });
    Object.defineProperty(region, "scrollHeight", { value: 1000, configurable: true });

    await user.keyboard("{ArrowUp}");
    expect(region).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(region.scrollTop).toBe(40);

    await user.keyboard("{PageDown}");
    expect(region.scrollTop).toBe(120);

    await user.keyboard("{ArrowUp}");
    expect(region.scrollTop).toBe(80);
  });

  it("invokes onEnterReview once for the global Enter shortcut and does not double-invoke it when Enter presses the focused View Results button", async () => {
    const user = userEvent.setup();
    const onEnterReview = vi.fn();
    render(
      <KeyboardProvider>
        <FooterProvider>
          <ReviewSummaryView
            issues={[makeIssue({ id: "1", severity: "high", title: "Issue 1" })]}
            reviewId="review-1"
            onEnterReview={onEnterReview}
            onBack={vi.fn()}
          />
        </FooterProvider>
      </KeyboardProvider>,
    );

    await user.keyboard("{Enter}");
    expect(onEnterReview).toHaveBeenCalledTimes(1);

    screen.getByRole("button", { name: /view results/i }).focus();
    await user.keyboard("{Enter}");
    expect(onEnterReview).toHaveBeenCalledTimes(2);
  });
});
