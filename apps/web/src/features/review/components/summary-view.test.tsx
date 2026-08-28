import { FooterProvider } from "@diffgazer/core/footer";
import type { FailedTerminalOutcome } from "@diffgazer/core/review";
import type { RunnableProductId } from "@diffgazer/core/schemas/config";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { ReviewIssue, ReviewMode } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FooterView } from "@/testing/footer-view";
import { HeaderChromeHarness } from "@/testing/header-chrome";
import { expectSingleReticle } from "@/testing/reticle";
import { ReviewSummaryView, type SummaryAction } from "./summary-view";

interface SummaryProps {
  droppedBelowThreshold?: number;
  droppedDuplicates?: number;
  minSeverity?: ReviewIssue["severity"];
  lensStats?: LensStat[];
  issues?: ReviewIssue[];
  reviewId?: string | null;
  durationMs?: number;
  mode?: ReviewMode;
  createdAt?: string;
  fileCount?: number;
  additions?: number;
  deletions?: number;
  productId?: RunnableProductId;
  modelId?: string;
  outcome?: FailedTerminalOutcome;
  cleanRunActions?: SummaryAction[];
  onEnterReview?: () => void;
  onBack?: () => void;
}

function summaryElement(props?: SummaryProps) {
  return (
    <ReviewSummaryView
      issues={props?.issues ?? [makeIssue({ id: "1", severity: "high", title: "Issue 1" })]}
      reviewId={props?.reviewId === undefined ? "review-1" : props.reviewId}
      durationMs={props?.durationMs}
      mode={props?.mode}
      createdAt={props?.createdAt}
      fileCount={props?.fileCount}
      additions={props?.additions}
      deletions={props?.deletions}
      productId={props?.productId}
      modelId={props?.modelId}
      droppedBelowThreshold={props?.droppedBelowThreshold}
      droppedDuplicates={props?.droppedDuplicates}
      minSeverity={props?.minSeverity}
      lensStats={props?.lensStats}
      outcome={props?.outcome}
      cleanRunActions={props?.cleanRunActions}
      onEnterReview={props?.onEnterReview ?? vi.fn()}
      onBack={props?.onBack ?? vi.fn()}
    />
  );
}

function renderSummary(props?: SummaryProps) {
  return render(
    <KeyboardProvider>
      <FooterProvider>
        {summaryElement(props)}
        <FooterView />
      </FooterProvider>
    </KeyboardProvider>,
  );
}

// jsdom has no layout; pin the metrics that make the region overflow.
function pinOverflow(region: HTMLElement) {
  Object.defineProperty(region, "clientHeight", { value: 100, configurable: true });
  Object.defineProperty(region, "scrollHeight", { value: 1000, configurable: true });
}

describe("ReviewSummaryView", () => {
  it("headlines the outcome and carries the shortened run id on the receipt stub", () => {
    renderSummary({ reviewId: "7685a1b2-0000-4000-8000-000000000000" });

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Review Complete");
    // The id is data, not a headline: it lives on the stub torn off the ledger.
    expect(heading).not.toHaveTextContent("#7685");
    expect(screen.getByText("#7685a1b2")).toBeVisible();
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

    expect(screen.getByText("2 issues in 2 files")).toBeVisible();
    expect(screen.queryByText(/^Duration:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Found .* across/)).not.toBeInTheDocument();
  });

  it("falls back to #unknown on the receipt stub when the review id is missing", () => {
    renderSummary({ reviewId: null });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Review Complete");
    expect(screen.getByText("#unknown")).toBeVisible();
  });

  it("headlines a partial run honestly when a lens failed but the run completed", () => {
    renderSummary({
      reviewId: "7685a1b2-0000-4000-8000-000000000000",
      lensStats: [
        { lensId: "correctness", issueCount: 2, status: "success" },
        { lensId: "security", issueCount: 0, status: "failed", errorCode: "STREAM_ERROR" },
      ],
    });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Review Partially Complete",
    );
    // The frame agrees with the headline: warning tone, not success-green.
    expect(screen.getByRole("region", { name: "Run status" })).toHaveAttribute(
      "data-tone",
      "warning",
    );
  });

  it("states the run's scope and elapsed time as receipt rows, not a fact line", () => {
    renderSummary({
      durationMs: 2500,
      mode: "unstaged",
      fileCount: 12,
      additions: 248,
      deletions: 96,
      productId: "deepseek",
      modelId: "deepseek-chat",
    });

    expect(screen.getByText("1 issue in 1 file")).toBeVisible();
    expect(screen.getByText("Unstaged · 12 files · +248 -96")).toBeVisible();
    // The same grain the TUI receipt and a saved run read: the product that ran
    // it, named against the model id the receipt keeps.
    expect(screen.getByText("DeepSeek / deepseek-chat")).toBeVisible();
    expect(screen.getByText("2s")).toBeVisible();
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

  it("renders the engine-dispatched synthesis lens under its display label", () => {
    renderSummary({
      lensStats: [
        { lensId: "correctness", issueCount: 1, status: "success" },
        { lensId: "synthesis", issueCount: 2, status: "success" },
      ],
    });

    const table = screen.getByRole("table", { name: /issues by lens/i });
    expect(within(table).getByRole("rowheader", { name: "Synthesis" })).toHaveAttribute(
      "scope",
      "row",
    );
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

  it("leaves the summary with Escape and adds no Back of its own to the panel", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    renderSummary({ onBack });

    // The header ← Back is the screen's only Back; the panel's own copy pointed
    // at the same target and read as a second, different exit.
    expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("puts [View Results] alone in the action row and lands mount focus on it", async () => {
    renderSummary();

    const viewResults = screen.getByRole("button", { name: /view results/i });
    expect(screen.getAllByRole("button")).toEqual([viewResults]);

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

    pinOverflow(screen.getByRole("region", { name: "Review summary" }));
    await user.keyboard("{ArrowUp}");
    const region = screen.getByRole("region", { name: "Review summary" });
    expect(region).toHaveFocus();
    expectSingleReticle(container);
  });

  it("drops the action highlight when Shift+Tab moves focus to the summary region", async () => {
    const user = userEvent.setup();
    const { container } = renderSummary();
    const viewResults = screen.getByRole("button", { name: /view results/i });
    await waitFor(() => expect(viewResults).toHaveFocus());

    await user.tab({ shift: true });
    // The region wears no ring of its own, so a mark left on [View Results]
    // would be the only control mark on screen - on a button without focus.
    expect(screen.getByRole("region", { name: "Review summary" })).toHaveFocus();
    expect(viewResults).not.toHaveAttribute("data-highlighted");
    expectSingleReticle(container);
  });

  it("enters the summary region with ArrowUp only while it overflows, and returns to the actions with ArrowDown", async () => {
    const user = userEvent.setup();
    renderSummary();
    const viewResults = screen.getByRole("button", { name: /view results/i });
    await waitFor(() => expect(viewResults).toHaveFocus());
    const region = screen.getByRole("region", { name: "Review summary" });

    // Nothing overflows, so the region scrolls nowhere and ↑ does not stop in it.
    await user.keyboard("{ArrowUp}");
    expect(region).not.toHaveFocus();

    // Reached by Tab instead, it still hands the row back with ↓ - a pure zone
    // move while there is nothing to scroll.
    await user.tab({ shift: true });
    expect(region).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(viewResults).toHaveFocus();
    expect(viewResults).toHaveAttribute("data-highlighted");

    // Overflowing, ↑ stops in the region so the content stays keyboard-scrollable.
    pinOverflow(region);
    await user.keyboard("{ArrowUp}");
    expect(region).toHaveFocus();
  });

  it("returns to the actions when ArrowDown reaches the bottom of an overflowing summary", async () => {
    const user = userEvent.setup();
    renderSummary();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /view results/i })).toHaveFocus(),
    );
    const region = screen.getByRole("region", { name: "Review summary" });
    pinOverflow(region);

    await user.keyboard("{ArrowUp}");
    await user.keyboard("{ArrowDown}");
    // Content below still owns ↓.
    expect(region).toHaveFocus();
    expect(region.scrollTop).toBe(40);

    await user.keyboard("{End}");
    await user.keyboard("{ArrowDown}");
    const viewResults = screen.getByRole("button", { name: /view results/i });
    expect(viewResults).toHaveFocus();
    expect(viewResults).toHaveAttribute("data-highlighted");
  });

  it("names the keys of the zone that holds focus in the footer", async () => {
    const user = userEvent.setup();
    renderSummary();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /view results/i })).toHaveFocus(),
    );
    const legend = screen.getByRole("contentinfo");

    // A one-action row has nothing to move between, so it names only the key
    // that acts.
    expect(within(legend).getByText("View Results")).toBeInTheDocument();
    expect(within(legend).queryByText("Scroll")).not.toBeInTheDocument();

    pinOverflow(screen.getByRole("region", { name: "Review summary" }));
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("region", { name: "Review summary" })).toHaveFocus();

    // The keys that do work inside the region are named there, and nowhere else.
    expect(await within(legend).findByText("Scroll")).toBeInTheDocument();
    expect(within(legend).getByText("Actions")).toBeInTheDocument();
  });

  it("scrolls the summary region with arrow and page keys after ArrowUp focuses it", async () => {
    const user = userEvent.setup();
    renderSummary();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /view results/i })).toHaveFocus(),
    );
    const region = screen.getByRole("region", { name: "Review summary" });
    pinOverflow(region);

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

describe("ReviewSummaryView failure mode", () => {
  const FAILED_RUN: LensStat[] = [
    { lensId: "correctness", issueCount: 1, status: "success" },
    { lensId: "security", issueCount: 1, status: "success" },
    { lensId: "performance", issueCount: 0, status: "failed", errorCode: "BUDGET_EXHAUSTED" },
    { lensId: "tests", issueCount: 0, status: "failed", errorCode: "BUDGET_EXHAUSTED" },
    { lensId: "simplicity", issueCount: 0, status: "failed", errorCode: "BUDGET_EXHAUSTED" },
  ];

  const KEPT_ISSUES = [
    makeIssue({ id: "1", severity: "high", title: "Kept issue", file: "a.ts" }),
    makeIssue({ id: "2", severity: "low", title: "Other kept issue", file: "b.ts" }),
  ];

  it("reports the outcome the run had instead of signing it off as complete", () => {
    renderSummary({ outcome: "budget-exhausted", lensStats: FAILED_RUN, issues: KEPT_ISSUES });

    expect(screen.getByRole("alert")).toHaveTextContent("Budget Exhausted");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Budget Exhausted");
    expect(screen.queryByText(/Review Complete/)).not.toBeInTheDocument();
    expect(screen.getByText("2 of 5 lenses completed · 2 issues")).toBeVisible();
  });

  it("names the lenses whose findings the run never produced, without restating the ratio", () => {
    renderSummary({ outcome: "budget-exhausted", lensStats: FAILED_RUN, issues: KEPT_ISSUES });

    expect(
      screen.getByText("Issues from Optimizer, Tester and Simplifier are missing."),
    ).toBeVisible();
    // The coverage line above already says how far the run got; the same fact in
    // the opposite polarity is the hardest form to read, and this is one alert.
    expect(screen.queryByText(/lenses failed/)).not.toBeInTheDocument();
    const lensTable = screen.getByRole("table", { name: /issues by lens/i });
    expect(within(lensTable).getAllByText("failed [BUDGET_EXHAUSTED]")).toHaveLength(3);
  });

  it("says the findings were not kept when the outcome discards them", () => {
    renderSummary({
      outcome: "timed-out",
      lensStats: [
        { lensId: "correctness", issueCount: 3, status: "success" },
        { lensId: "security", issueCount: 0, status: "failed", errorCode: "SESSION_TIMEOUT" },
      ],
      issues: [],
    });

    // The stored per-lens counts survive the drop, so "0 issues" would otherwise
    // sit above a lens row reading "3" with nothing reconciling them.
    expect(screen.getByText("1 of 2 lenses completed · 0 issues")).toBeVisible();
    const lensTable = screen.getByRole("table", { name: /issues by lens/i });
    expect(within(lensTable).getByText("3")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Findings are not kept for a run that ended this way; the counts below are what each lens reported before it ended.",
      ),
    ).toBeVisible();
  });

  // A cancelled run keeps what it streamed too: the server writes those partial
  // findings before it terminates the session.
  it.each([
    "budget-exhausted",
    "cancelled",
  ] as const)("stays quiet about dropped findings for a %s run, which keeps them", (outcome) => {
    renderSummary({ outcome, lensStats: FAILED_RUN, issues: KEPT_ISSUES });

    expect(screen.queryByText(/Findings are not kept/)).not.toBeInTheDocument();
  });

  it("keeps the findings the failed run did produce reachable", async () => {
    const user = userEvent.setup();
    const onEnterReview = vi.fn();
    renderSummary({
      outcome: "budget-exhausted",
      lensStats: FAILED_RUN,
      issues: KEPT_ISSUES,
      onEnterReview,
    });

    expect(screen.getByText("Kept issue")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /view results/i }));
    expect(onEnterReview).toHaveBeenCalledTimes(1);
  });

  it("offers no results screen when the failed run kept no findings", async () => {
    const user = userEvent.setup();
    const onEnterReview = vi.fn();
    const { container } = renderSummary({
      outcome: "timed-out",
      lensStats: [{ lensId: "correctness", issueCount: 0, status: "success" }],
      issues: [],
      onEnterReview,
    });

    // Nothing left to act on, so the screen carries no action row at all.
    expect(screen.queryByRole("button", { name: /view results/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();

    // Mount focus falls to the summary region instead of vanishing.
    const region = screen.getByRole("region", { name: "Review summary" });
    await waitFor(() => expect(region).toHaveFocus());
    expectSingleReticle(container);

    await user.keyboard("{Enter}");
    expect(onEnterReview).not.toHaveBeenCalled();

    // ↓ at the bottom of the range has no row to hand back to and leaves focus
    // where it is.
    await user.keyboard("{ArrowDown}");
    expect(region).toHaveFocus();

    const legend = within(screen.getByRole("contentinfo"));
    expect(legend.queryByText("View Results")).not.toBeInTheDocument();
    expect(legend.queryByText("Actions")).not.toBeInTheDocument();
    // The region is the only zone, so its own keys are what the legend names.
    expect(legend.getByText("Scroll")).toBeInTheDocument();
  });

  it("says the run got nowhere without congratulating a clean sheet", () => {
    renderSummary({
      outcome: "timed-out",
      lensStats: [{ lensId: "correctness", issueCount: 0, status: "success" }],
      issues: [],
      durationMs: 3800,
    });

    expect(screen.getByText("1 of 1 lens completed · 0 issues")).toBeVisible();
    // Elapsed is a ledger row now, not a tail on the coverage sentence.
    expect(screen.getByText("3s")).toBeVisible();
    expect(screen.queryByText(/No issues found/)).not.toBeInTheDocument();
  });
});

describe("ReviewSummaryView clean run", () => {
  const CLEAN_RUN: SummaryProps = {
    issues: [],
    reviewId: "7685a1b2-0000-4000-8000-000000000000",
    durationMs: 8200,
    mode: "unstaged",
    createdAt: "2026-08-28T14:02:00.000Z",
    fileCount: 12,
    additions: 248,
    deletions: 96,
    productId: "deepseek",
    modelId: "deepseek-chat",
    lensStats: [
      { lensId: "correctness", issueCount: 0, status: "success" },
      { lensId: "security", issueCount: 0, status: "success" },
    ],
  };

  function cleanActions(onRunAgain = vi.fn(), onHome = vi.fn()): SummaryAction[] {
    return [
      { label: "Run Again", onSelect: onRunAgain },
      { label: "Back to Home", onSelect: onHome },
    ];
  }

  it("shows the pass statement over the run's receipt and nothing made of zeros", () => {
    renderSummary({ ...CLEAN_RUN, cleanRunActions: cleanActions() });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Passed — no issues found");
    expect(screen.getByText("Unstaged · 12 files · +248 -96")).toBeVisible();
    expect(screen.getByText("correctness · security")).toBeVisible();
    expect(screen.getByText("DeepSeek / deepseek-chat")).toBeVisible();
    expect(screen.getByText("8s")).toBeVisible();
    expect(screen.getByText(/^#7685a1b2/)).toBeVisible();

    expect(screen.queryByRole("region", { name: "Severity breakdown" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Issues by category" })).not.toBeInTheDocument();
    expect(screen.queryByText("Nothing to categorise.")).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: /issues by lens/i })).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("offers no way into an empty results screen", async () => {
    const user = userEvent.setup();
    const onEnterReview = vi.fn();
    renderSummary({ ...CLEAN_RUN, onEnterReview, cleanRunActions: cleanActions() });

    expect(screen.queryByRole("button", { name: /view results/i })).not.toBeInTheDocument();
    const legend = within(screen.getByRole("contentinfo"));
    expect(legend.queryByText("View Results")).not.toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(onEnterReview).not.toHaveBeenCalled();
  });

  it("lands mount focus on the primary action and names the row's keys in the footer", async () => {
    const user = userEvent.setup();
    const onRunAgain = vi.fn();
    renderSummary({ ...CLEAN_RUN, cleanRunActions: cleanActions(onRunAgain) });

    const runAgain = screen.getByRole("button", { name: /run again/i });
    await waitFor(() => expect(runAgain).toHaveFocus());
    expect(runAgain).toHaveAttribute("data-highlighted");

    const legend = within(screen.getByRole("contentinfo"));
    expect(legend.getByText("Move Action")).toBeInTheDocument();
    expect(legend.getByText("Run Again")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(onRunAgain).toHaveBeenCalledTimes(1);

    await user.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /back to home/i })).toHaveFocus(),
    );
    expect(legend.getByText("Back to Home")).toBeInTheDocument();
  });

  it("collapses a saved clean run to its one exit", async () => {
    const user = userEvent.setup();
    const onBackToHistory = vi.fn();
    renderSummary({
      ...CLEAN_RUN,
      cleanRunActions: [{ label: "Back to History", onSelect: onBackToHistory }],
    });

    const backToHistory = screen.getByRole("button", { name: "Back to History" });
    expect(screen.getAllByRole("button")).toEqual([backToHistory]);
    expect(screen.queryByRole("button", { name: /run again/i })).not.toBeInTheDocument();

    await user.click(backToHistory);
    expect(onBackToHistory).toHaveBeenCalledTimes(1);
  });

  it("still leaves through the screen's single Escape", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    renderSummary({ ...CLEAN_RUN, onBack, cleanRunActions: cleanActions() });

    await user.keyboard("{Escape}");
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("qualifies the pass when findings were hidden below the severity floor", () => {
    renderSummary({
      ...CLEAN_RUN,
      droppedBelowThreshold: 4,
      minSeverity: "medium",
      cleanRunActions: cleanActions(),
    });

    // A run that hid findings has not got a clean sheet, so the statement names
    // the floor instead of congratulating.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "No issues at or above medium",
    );
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveTextContent("Passed");
    expect(screen.getByRole("note")).toHaveTextContent(
      "4 below-threshold issues hidden (threshold: medium)",
    );
  });

  it("keeps a zero-issue run with a failed lens on the partial summary, still with no results entry", async () => {
    const user = userEvent.setup();
    const onEnterReview = vi.fn();
    renderSummary({
      ...CLEAN_RUN,
      lensStats: [
        { lensId: "correctness", issueCount: 0, status: "success" },
        { lensId: "security", issueCount: 0, status: "failed", errorCode: "STREAM_ERROR" },
      ],
      onEnterReview,
      cleanRunActions: cleanActions(),
    });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Review Partially Complete",
    );
    expect(screen.getByRole("region", { name: "Run status" })).toHaveAttribute(
      "data-tone",
      "warning",
    );
    expect(screen.queryByText("Passed — no issues found")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /view results/i })).not.toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(onEnterReview).not.toHaveBeenCalled();
  });
});

describe("ReviewSummaryView chrome hand-off", () => {
  function renderSummaryWithChrome(props?: SummaryProps) {
    return render(
      <KeyboardProvider>
        <FooterProvider>
          <HeaderChromeHarness>
            {summaryElement(props)}
            <FooterView />
          </HeaderChromeHarness>
        </FooterProvider>
      </KeyboardProvider>,
    );
  }

  // The harness renders the shell's Back button before the screen; the summary
  // adds none of its own, so this is the only Back on the page.
  function chromeBack() {
    return screen.getByRole("button", { name: "Back" });
  }

  // The summary does not overflow here, so ↑ leaves the action row for the
  // chrome in one press; the overflowing ladder is pinned on its own below.
  async function park(user: ReturnType<typeof userEvent.setup>) {
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /view results/i })).toHaveFocus(),
    );
    await user.keyboard("{ArrowUp}");
    const back = chromeBack();
    await waitFor(() => expect(back).toHaveFocus());
    return back;
  }

  it("renders exactly one Back on the summary, the header chrome one", async () => {
    renderSummaryWithChrome();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /view results/i })).toHaveFocus(),
    );

    expect(screen.getAllByRole("button", { name: /back/i })).toEqual([chromeBack()]);
  });

  it("hands focus to the header Back straight from the action row when the summary does not overflow", async () => {
    const user = userEvent.setup();
    const { container } = renderSummaryWithChrome();
    const region = screen.getByRole("region", { name: "Review summary" });

    await park(user);

    // A region with nothing to scroll is dead weight on the way up, so ↑ never
    // stopped there and the mark left the page with focus.
    expect(region).not.toHaveFocus();
    // Nothing in the page is marked while focus sits in the chrome.
    const viewResults = screen.getByRole("button", { name: /view results/i });
    expect(viewResults).not.toHaveAttribute("data-highlighted");

    // The hand-off remembered the button it left, so ↓ returns to it directly.
    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(viewResults).toHaveFocus());
    expect(viewResults).toHaveAttribute("data-highlighted");
    expectSingleReticle(container);
  });

  it("stops in the summary region on the way to the header Back while it overflows", async () => {
    const user = userEvent.setup();
    const { container } = renderSummaryWithChrome();
    const region = screen.getByRole("region", { name: "Review summary" });
    pinOverflow(region);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /view results/i })).toHaveFocus(),
    );

    await user.keyboard("{ArrowUp}");
    expect(region).toHaveFocus();

    // Only the top of the scroll range hands off; the region owns ↑ until then.
    await user.keyboard("{ArrowUp}");
    await waitFor(() => expect(chromeBack()).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(region).toHaveFocus());
    expectSingleReticle(container);
  });

  it("keeps the summary's own arrows out of the chrome while focus is parked there", async () => {
    const user = userEvent.setup();
    renderSummaryWithChrome();

    const parkedBack = await park(user);
    const viewResults = screen.getByRole("button", { name: /view results/i });

    await user.keyboard("{ArrowLeft}");
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{ArrowUp}");

    expect(parkedBack).toHaveFocus();
    // Nothing in the page is marked either: the mark follows focus, and focus
    // is in the chrome.
    expect(viewResults).not.toHaveAttribute("data-highlighted");
  });

  it("names the way back in the footer while parked, and nothing that is inert", async () => {
    const user = userEvent.setup();
    renderSummaryWithChrome();
    const legend = within(screen.getByRole("contentinfo"));

    await park(user);

    expect(legend.getByText("Summary")).toBeInTheDocument();
    expect(legend.getByText("Back")).toBeInTheDocument();
    expect(legend.queryByText("View Results")).not.toBeInTheDocument();
    expect(legend.queryByText("Scroll")).not.toBeInTheDocument();
  });

  it("ends the park when Tab carries focus back into the page", async () => {
    const user = userEvent.setup();
    renderSummaryWithChrome();
    const legend = within(screen.getByRole("contentinfo"));

    await park(user);

    // Tab out of the chrome is native, so nothing hands the zone back: the page
    // has to notice focus returning or it keeps advertising a park that ended.
    await user.tab();
    const region = screen.getByRole("region", { name: "Review summary" });
    expect(region).toHaveFocus();
    expect(await legend.findByText("Scroll")).toBeInTheDocument();
    expect(legend.getByText("Actions")).toBeInTheDocument();
    expect(legend.queryByText("Summary")).not.toBeInTheDocument();

    // And the arrow is native on the Back button again: this park is over, so
    // Shift+Tab back to the chrome reaches it the way Tab does.
    await user.tab({ shift: true });
    const parkedBack = chromeBack();
    expect(parkedBack).toHaveFocus();
    // The legend must not name a return the arrow will decline.
    expect(legend.queryByText("Summary")).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}");

    expect(parkedBack).toHaveFocus();
    expect(region).not.toHaveFocus();
  });

  it("stops naming the page's keys once Tab carries focus into the chrome", async () => {
    const user = userEvent.setup();
    renderSummaryWithChrome();
    const legend = within(screen.getByRole("contentinfo"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /view results/i })).toHaveFocus(),
    );
    expect(legend.getByText("View Results")).toBeInTheDocument();

    // Into the region, then out of the page the way Tab goes: the row's keys are
    // scoped to the panel, so out here every one of them is inert.
    pinOverflow(screen.getByRole("region", { name: "Review summary" }));
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("region", { name: "Review summary" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(chromeBack()).toHaveFocus();

    expect(await legend.findByText("Back")).toBeInTheDocument();
    expect(legend.queryByText("View Results")).not.toBeInTheDocument();
    expect(legend.queryByText("Scroll")).not.toBeInTheDocument();
    // No arrow took focus up, so there is no way back to name either.
    expect(legend.queryByText("Summary")).not.toBeInTheDocument();
  });

  it("ignores ArrowDown on the Back button reached by Tab, where no arrow took focus up", async () => {
    const user = userEvent.setup();
    renderSummaryWithChrome();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /view results/i })).toHaveFocus(),
    );

    // Into the region, then out of the page the way Tab goes.
    pinOverflow(screen.getByRole("region", { name: "Review summary" }));
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("region", { name: "Review summary" })).toHaveFocus();
    await user.tab({ shift: true });
    const parkedBack = chromeBack();
    expect(parkedBack).toHaveFocus();

    await user.keyboard("{ArrowDown}");

    expect(parkedBack).toHaveFocus();
    expect(screen.getByRole("region", { name: "Review summary" })).not.toHaveFocus();
  });
});
