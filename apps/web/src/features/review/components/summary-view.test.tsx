import { FooterProvider } from "@diffgazer/core/footer";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
      </FooterProvider>
    </KeyboardProvider>,
  );
}

describe("ReviewSummaryView", () => {
  it("shortens the run id in the heading", () => {
    renderSummary({ reviewId: "7685a1b2-0000-4000-8000-000000000000" });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Review Complete #7685");
    expect(screen.getByRole("heading", { level: 2, name: /top issues preview/i })).toBeVisible();
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

  it("focuses the summary region on mount so keys land somewhere instead of document.body", () => {
    renderSummary();

    expect(screen.getByRole("region", { name: "Review summary" })).toHaveFocus();
  });

  it("scrolls the focused summary region with arrow and page keys when content overflows", async () => {
    const user = userEvent.setup();
    renderSummary();
    const region = screen.getByRole("region", { name: "Review summary" });
    // jsdom has no layout; pin the metrics that make the region overflow.
    Object.defineProperty(region, "clientHeight", { value: 100, configurable: true });
    Object.defineProperty(region, "scrollHeight", { value: 1000, configurable: true });

    expect(region).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(region.scrollTop).toBe(40);

    await user.keyboard("{PageDown}");
    expect(region.scrollTop).toBe(120);

    await user.keyboard("{ArrowUp}");
    expect(region.scrollTop).toBe(80);
  });

  it("keeps the Tab path summary region → Back → View Results", async () => {
    const user = userEvent.setup();
    renderSummary();

    expect(screen.getByRole("region", { name: "Review summary" })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole("button", { name: /view results/i })).toHaveFocus();
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
