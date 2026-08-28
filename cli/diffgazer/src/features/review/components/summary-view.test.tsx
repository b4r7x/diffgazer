import { FooterProvider } from "@diffgazer/core/footer";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { cleanup, render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { flush } from "../../../testing/flush";
import { waitUntil } from "../../../testing/wait-until";
import { CliThemeProvider } from "../../../theme/provider";
import { FooterProbe } from "../testing/progress-view";
import { ReviewSummaryView, type ReviewSummaryViewProps } from "./summary-view";

vi.mock("@diffgazer/core/api/hooks", () => ({
  useConfigurationInit: () => ({ data: undefined, isLoading: false }),
}));

const summaryContentZone = vi.hoisted(() => ({ columns: 100, rows: 40 }));

vi.mock("../../../components/layout/global", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../components/layout/global")>()),
  useContentZone: () => ({
    columns: summaryContentZone.columns,
    contentColumns: summaryContentZone.columns,
    contentRows: summaryContentZone.rows - 4,
  }),
}));

beforeEach(() => {
  summaryContentZone.columns = 100;
  summaryContentZone.rows = 40;
});

afterEach(() => {
  cleanup();
});

function renderSummary(props?: {
  droppedDuplicates?: number;
  droppedBelowThreshold?: number;
  minSeverity?: ReviewIssue["severity"];
  lensStats?: LensStat[];
  issues?: ReviewIssue[];
  terminalOutcome?: ReviewSummaryViewProps["terminalOutcome"];
  onContinue?: () => void;
  onBack?: () => void;
}) {
  return render(
    <FooterProvider initialShortcuts={[]}>
      <CliThemeProvider initialTheme="dark">
        <ReviewSummaryView
          issues={props?.issues ?? [makeIssue({ id: "1", severity: "high", title: "Issue 1" })]}
          reviewId="review-1"
          durationMs={1200}
          droppedDuplicates={props?.droppedDuplicates}
          droppedBelowThreshold={props?.droppedBelowThreshold}
          minSeverity={props?.minSeverity}
          lensStats={props?.lensStats}
          terminalOutcome={props?.terminalOutcome}
          onContinue={props?.onContinue ?? vi.fn()}
          onBack={props?.onBack ?? vi.fn()}
        />
      </CliThemeProvider>
    </FooterProvider>,
  );
}

const BUDGET_LENS_STATS: LensStat[] = [
  { lensId: "correctness", issueCount: 1, status: "success" },
  { lensId: "security", issueCount: 0, status: "failed", errorCode: "BUDGET_EXHAUSTED" },
  { lensId: "tests", issueCount: 0, status: "failed", errorCode: "BUDGET_EXHAUSTED" },
];

const ESCAPE = "\u001b";

describe("ReviewSummaryView (TUI)", () => {
  test("renders the hidden-count notice naming the severity threshold", () => {
    const { lastFrame } = renderSummary({ droppedBelowThreshold: 3, minSeverity: "low" });

    expect(lastFrame() ?? "").toContain("3 below-threshold issues hidden (threshold: low)");
  });

  test("renders the cross-lens duplicate count transition", () => {
    const { lastFrame } = renderSummary({ droppedDuplicates: 1 });

    expect(lastFrame() ?? "").toContain("1 duplicate issue collapsed across lenses (2 → 1 issue)");
  });

  test("renders the per-lens stats table including a failed lens error code", () => {
    const { lastFrame } = renderSummary({
      lensStats: [
        { lensId: "correctness", issueCount: 2, status: "success" },
        { lensId: "security", issueCount: 0, status: "failed", errorCode: "CANCELLED" },
      ],
    });
    const frame = lastFrame() ?? "";

    expect(frame).toContain("Correctness");
    expect(frame).toContain("2 issues");
    expect(frame).toContain("Security");
    expect(frame).toContain("failed (CANCELLED)");
  });

  test("headlines a partial run honestly when a lens failed but the run completed", () => {
    const { lastFrame } = renderSummary({
      lensStats: [
        { lensId: "correctness", issueCount: 2, status: "success" },
        { lensId: "security", issueCount: 0, status: "failed", errorCode: "STREAM_ERROR" },
      ],
    });

    // The section header renders the headline uppercased.
    expect(lastFrame() ?? "").toMatch(/review partially complete/i);
  });

  test("renders the synthesis lens row with its display label like any other lens", () => {
    const { lastFrame } = renderSummary({
      lensStats: [
        { lensId: "correctness", issueCount: 2, status: "success" },
        { lensId: "synthesis", issueCount: 1, status: "success" },
      ],
    });
    const frame = lastFrame() ?? "";

    expect(frame).toContain("Synthesis");
    expect(frame).toContain("1 issue");
  });

  test("omits the hidden-count notice when nothing was dropped", () => {
    const { lastFrame } = renderSummary();

    expect(lastFrame() ?? "").not.toContain("below-threshold");
  });

  test("sends Enter through the rendered frame and calls onContinue once", async () => {
    const onContinue = vi.fn();
    const { stdin } = render(
      <FooterProvider initialShortcuts={[]}>
        <CliThemeProvider initialTheme="dark">
          <ReviewSummaryView
            issues={[makeIssue({ id: "1", severity: "high", title: "Issue 1" })]}
            reviewId="review-1"
            durationMs={1200}
            onContinue={onContinue}
          />
        </CliThemeProvider>
      </FooterProvider>,
    );

    stdin.write("\r");
    await new Promise((resolve) => setImmediate(resolve));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  test("advertises scrolling in the shortcut bar alongside View Results", async () => {
    const { lastFrame } = render(
      <FooterProvider initialShortcuts={[]}>
        <CliThemeProvider initialTheme="dark">
          <ReviewSummaryView
            issues={[makeIssue({ id: "1", severity: "high", title: "Issue 1" })]}
            reviewId="review-1"
            durationMs={1200}
            onContinue={vi.fn()}
          />
          <FooterProbe />
        </CliThemeProvider>
      </FooterProvider>,
    );

    await vi.waitFor(() => expect(lastFrame() ?? "").toContain("↑/↓ Scroll, Enter View Results"));
  });

  test("formats a full review id with the shared compact label on the receipt", () => {
    const { lastFrame } = render(
      <FooterProvider initialShortcuts={[]}>
        <CliThemeProvider initialTheme="dark">
          <ReviewSummaryView
            issues={[]}
            reviewId="12345678-1234-4123-8123-123456789abc"
            durationMs={1200}
            onContinue={vi.fn()}
          />
        </CliThemeProvider>
      </FooterProvider>,
    );

    expect(lastFrame() ?? "").toContain("Run    : #12345678");
    expect(lastFrame() ?? "").not.toContain("12345678-1234");
  });
});

describe("ReviewSummaryView clean run (TUI)", () => {
  const CLEAN_LENS_STATS: LensStat[] = [
    { lensId: "correctness", issueCount: 0, status: "success" },
    { lensId: "security", issueCount: 0, status: "success" },
  ];

  function renderClean(props?: Partial<ReviewSummaryViewProps>) {
    return render(
      <FooterProvider initialShortcuts={[]}>
        <CliThemeProvider initialTheme="dark">
          <ReviewSummaryView
            issues={[]}
            reviewId="review-1"
            durationMs={8200}
            lensStats={CLEAN_LENS_STATS}
            runFacts={{
              mode: "unstaged",
              fileCount: 12,
              additions: 248,
              deletions: 96,
              productId: "deepseek",
              modelId: "deepseek-chat",
              createdAt: "2026-08-28T14:02:00.000Z",
            }}
            onContinue={vi.fn()}
            onRunAgain={vi.fn()}
            onBack={vi.fn()}
            {...props}
          />
          <FooterProbe />
        </CliThemeProvider>
      </FooterProvider>,
    );
  }

  test("pays for the pass with the run's receipt instead of zeroed sections", () => {
    const frame = renderClean().lastFrame() ?? "";

    expect(frame).toContain("✔ Passed — no issues found");
    expect(frame).toContain("Scope  : Unstaged · 12 files · +248 -96");
    expect(frame).toContain("Lenses : correctness · security");
    expect(frame).toContain("Model  : DeepSeek / deepseek-chat");
    expect(frame).toContain("Elapsed: 8s");
    expect(frame).toContain("── ──");
    expect(frame).toContain("Run    : #review-1 · ");
    expect(frame).not.toMatch(/severity breakdown/i);
    expect(frame).not.toMatch(/issues by category/i);
    expect(frame).not.toMatch(/issues by lens/i);
    expect(frame).not.toContain("Found 0 issues");
    expect(frame).not.toContain("0 issues");
  });

  test("offers no results entry, by button, shortcut, or Enter", async () => {
    const onContinue = vi.fn();
    const { stdin, lastFrame } = renderClean({ onContinue });

    await vi.waitFor(() => expect(lastFrame() ?? "").toContain("Run Again"));
    expect(lastFrame() ?? "").not.toContain("View Results");

    stdin.write("\r");
    await flush();

    expect(onContinue).not.toHaveBeenCalled();
    expect(lastFrame() ?? "").not.toContain("View Results");
  });

  test("mounts focus on Run Again and runs it once on Enter", async () => {
    const onRunAgain = vi.fn();
    const { stdin, lastFrame } = renderClean({ onRunAgain });

    await vi.waitFor(() =>
      expect(lastFrame() ?? "").toContain("Left/Right Actions, Enter Run Again"),
    );

    stdin.write("\r");
    await waitUntil(() => onRunAgain.mock.calls.length === 1);

    expect(onRunAgain).toHaveBeenCalledTimes(1);
  });

  test("moves to Back to Home with the arrow keys and names it in the legend", async () => {
    const onRunAgain = vi.fn();
    const onBack = vi.fn();
    const { stdin, lastFrame } = renderClean({ onRunAgain, onBack });

    stdin.write(`${ESCAPE}[C`);
    await vi.waitFor(() =>
      expect(lastFrame() ?? "").toContain("Left/Right Actions, Enter Back to Home"),
    );

    stdin.write("\r");
    await waitUntil(() => onBack.mock.calls.length === 1);

    expect(onRunAgain).not.toHaveBeenCalled();
  });

  test("collapses a saved run to its single labelled exit", async () => {
    const { lastFrame } = renderClean({ onRunAgain: undefined, backLabel: "Back to History" });

    await vi.waitFor(() => expect(lastFrame() ?? "").toContain("Enter Back to History"));
    const frame = lastFrame() ?? "";

    expect(frame).toContain("[ Back to History ]");
    expect(frame).not.toContain("Run Again");
    expect(frame).not.toContain("Left/Right Actions");
  });

  test("still leaves through the single Esc Back", async () => {
    const onBack = vi.fn();
    const { stdin } = renderClean({ onBack });

    stdin.write(ESCAPE);
    await waitUntil(() => onBack.mock.calls.length === 1);

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test("qualifies the pass when findings were hidden below the threshold", () => {
    const frame =
      renderClean({ droppedBelowThreshold: 4, minSeverity: "medium" }).lastFrame() ?? "";

    expect(frame).toContain("✔ No issues at or above medium");
    expect(frame).not.toContain("Passed — no issues found");
    expect(frame).toContain("4 below-threshold issues hidden (threshold: medium)");
  });

  test("keeps a zero-issue run with a failed lens on the partial summary, without results entry", async () => {
    const onContinue = vi.fn();
    const { stdin, lastFrame } = renderClean({
      lensStats: [
        { lensId: "correctness", issueCount: 0, status: "success" },
        { lensId: "security", issueCount: 0, status: "failed", errorCode: "STREAM_ERROR" },
      ],
      onContinue,
    });
    const frame = lastFrame() ?? "";

    expect(frame).toMatch(/review partially complete/i);
    expect(frame).not.toContain("Passed — no issues found");
    expect(frame).not.toContain("View Results");

    stdin.write("\r");
    await flush();

    expect(onContinue).not.toHaveBeenCalled();
  });
});

describe("ReviewSummaryView failure mode (TUI)", () => {
  test("headlines the outcome and says how far the run got instead of reading as a pass", () => {
    const { lastFrame } = renderSummary({
      terminalOutcome: "budget-exhausted",
      lensStats: BUDGET_LENS_STATS,
      issues: [],
    });
    const frame = lastFrame() ?? "";

    expect(frame).toContain("BUDGET EXHAUSTED #REVIEW-1");
    expect(frame).toContain("1 of 3 lenses completed · 0 issues");
    expect(frame).toContain("Issues from Guardian and Tester are missing.");
    expect(frame).toContain("Security");
    expect(frame).toContain("failed (BUDGET_EXHAUSTED)");
    expect(frame).not.toMatch(/review complete/i);
    expect(frame).not.toContain("Found 0 issues");
  });

  test("keeps Enter inert when the failed run kept no findings", async () => {
    const onContinue = vi.fn();
    const { stdin } = renderSummary({
      terminalOutcome: "budget-exhausted",
      lensStats: BUDGET_LENS_STATS,
      issues: [],
      onContinue,
    });

    stdin.write("\r");
    await flush();

    expect(onContinue).not.toHaveBeenCalled();
  });

  test("shows the findings the failed run kept and opens them with Enter", async () => {
    const onContinue = vi.fn();
    const { stdin, lastFrame } = renderSummary({
      terminalOutcome: "budget-exhausted",
      lensStats: BUDGET_LENS_STATS,
      issues: [makeIssue({ id: "kept-1", severity: "high", title: "Kept finding" })],
      onContinue,
    });

    expect(lastFrame() ?? "").toContain("1 of 3 lenses completed · 1 issue");
    expect(lastFrame() ?? "").toContain("Kept finding");

    stdin.write("\r");
    await flush();

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  test("says why an outcome that keeps no findings still lists per-lens counts", () => {
    const { lastFrame } = renderSummary({
      terminalOutcome: "timed-out",
      lensStats: [
        { lensId: "correctness", issueCount: 3, status: "success" },
        { lensId: "security", issueCount: 0, status: "failed", errorCode: "SESSION_TIMEOUT" },
      ],
      issues: [],
    });
    const frame = lastFrame() ?? "";

    expect(frame).toContain("1 of 2 lenses completed · 0 issues");
    expect(frame).toContain("Findings are not kept for a run that ended this way");
    expect(frame).toContain("3 issues");
  });

  test("keeps the per-lens counts unexplained when the outcome kept its findings", () => {
    const { lastFrame } = renderSummary({
      terminalOutcome: "budget-exhausted",
      lensStats: BUDGET_LENS_STATS,
      issues: [makeIssue({ id: "kept-1", severity: "high", title: "Kept finding" })],
    });

    expect(lastFrame() ?? "").not.toContain("Findings are not kept for a run that ended this way");
  });

  test("leaves a failed run with Escape", async () => {
    const onBack = vi.fn();
    const { stdin } = renderSummary({
      terminalOutcome: "budget-exhausted",
      lensStats: BUDGET_LENS_STATS,
      issues: [],
      onBack,
    });

    stdin.write(ESCAPE);
    await waitUntil(() => onBack.mock.calls.length === 1);

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
