import { FooterProvider } from "@diffgazer/core/footer";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { cleanup, render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { flush } from "../../../testing/flush";
import { waitUntil } from "../../../testing/wait-until";
import { CliThemeProvider } from "../../../theme/provider";
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

  test("formats a full review id with the shared compact label", () => {
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

    expect(lastFrame() ?? "").toContain("REVIEW COMPLETE #12345678");
    expect(lastFrame() ?? "").not.toContain("12345678-1234");
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
      terminalOutcome: "cancelled",
      lensStats: [
        { lensId: "correctness", issueCount: 3, status: "success" },
        { lensId: "security", issueCount: 0, status: "failed", errorCode: "CANCELLED" },
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
