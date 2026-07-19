import { FooterProvider } from "@diffgazer/core/footer";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { cleanup, render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import { CliThemeProvider } from "../../../theme/provider";
import { ReviewResultsView } from "./results-view";
import { ReviewSummaryView } from "./summary-view";

vi.mock("@diffgazer/core/api/hooks", () => ({
  useInit: () => ({ data: undefined, isLoading: false }),
}));

const summaryContentZone = vi.hoisted(() => ({ columns: 100, rows: 40 }));

vi.mock("../../../components/layout/global", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../components/layout/global")>()),
  useContentZone: () => ({
    columns: summaryContentZone.columns,
    rows: summaryContentZone.rows,
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
  cleanupRootFrames();
});

function renderSummary(props?: {
  droppedDuplicates?: number;
  droppedBelowThreshold?: number;
  minSeverity?: ReviewIssue["severity"];
  lensStats?: LensStat[];
}) {
  return render(
    <FooterProvider initialShortcuts={[]}>
      <CliThemeProvider initialTheme="dark">
        <ReviewSummaryView
          issues={[makeIssue({ id: "1", severity: "high", title: "Issue 1" })]}
          reviewId="review-1"
          durationMs={1200}
          droppedDuplicates={props?.droppedDuplicates}
          droppedBelowThreshold={props?.droppedBelowThreshold}
          minSeverity={props?.minSeverity}
          lensStats={props?.lensStats}
          onContinue={vi.fn()}
          onBack={vi.fn()}
        />
      </CliThemeProvider>
    </FooterProvider>,
  );
}

function expectNoRepeatedDividerRows(frame: string): void {
  const dividerRows = frame
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && /^─+$/.test(line));

  expect(dividerRows.length).toBeLessThanOrEqual(4);
}

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

  test.each([
    80, 100,
  ] as const)("keeps the %i-column summary heading, data, and actions in a 24-row root frame", async (columns) => {
    summaryContentZone.columns = columns;
    summaryContentZone.rows = 24;
    const issue = makeIssue({ id: "1", severity: "high", title: "Leaky state update" });
    const { lastFrame } = renderRootFrame(
      columns,
      24,
      <ReviewSummaryView
        issues={[issue]}
        reviewId="review-1"
        durationMs={1200}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("View Results (Enter)"));
    const frame = lastFrame() ?? "";
    expect(frame).toContain("REVIEW COMPLETE #REVIEW-1");
    expect(frame).toContain("Found 1 issue across 1 file with issues.");
    expect(frame).toContain("Leaky state update");
    expect(frame.split("\n")).toHaveLength(24);
    expectNoRepeatedDividerRows(frame);
  });

  test("renders long top-issue previews as one row each at 100 columns", async () => {
    summaryContentZone.columns = 100;
    summaryContentZone.rows = 24;
    const issues = Array.from({ length: 3 }, (_, index) =>
      makeIssue({
        id: `summary-${index + 1}`,
        file: `packages/review/src/generated/deeply/nested/summary-${index + 1}.typescript.ts`,
        title: `SUMMARY-${index + 1} Generated review title with enough detail to overflow its preview row`,
      }),
    );
    const { lastFrame } = renderRootFrame(
      100,
      24,
      <ReviewSummaryView
        issues={issues}
        reviewId="review-summary"
        durationMs={1200}
        onContinue={vi.fn()}
      />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("SUMMARY-3"));
    const previewRows = (lastFrame() ?? "").split("\n").filter((line) => line.includes("SUMMARY-"));
    expect(previewRows).toHaveLength(3);
  });

  test("keeps summary actions visible with a realistic 80x24 issue floor", async () => {
    summaryContentZone.columns = 80;
    summaryContentZone.rows = 24;
    const issues = Array.from({ length: 12 }, (_, index) =>
      makeIssue({
        id: `summary-floor-${index + 1}`,
        severity: index < 3 ? "blocker" : "high",
        file: `packages/review/src/generated/deeply/nested/summary-floor-${index + 1}.typescript.ts`,
        title: `Summary floor issue ${index + 1} with a realistic long diagnostic title`,
      }),
    );
    const { lastFrame } = renderRootFrame(
      80,
      24,
      <ReviewSummaryView
        issues={issues}
        reviewId="summary-floor"
        durationMs={1200}
        droppedDuplicates={2}
        droppedBelowThreshold={4}
        minSeverity="low"
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("View Results (Enter)"));
    expect(lastFrame()?.split("\n")).toHaveLength(24);
  });

  test("scrolls overflowed summary sections while keeping actions visible", async () => {
    summaryContentZone.columns = 80;
    summaryContentZone.rows = 24;
    const issues = Array.from({ length: 12 }, (_, index) =>
      makeIssue({
        id: `summary-scroll-${index + 1}`,
        severity: index < 3 ? "blocker" : "high",
        title: `Summary scroll issue ${index + 1}`,
      }),
    );
    const { stdin, lastFrame } = renderRootFrame(
      80,
      24,
      <ReviewSummaryView
        issues={issues}
        reviewId="summary-scroll"
        durationMs={1200}
        droppedBelowThreshold={4}
        minSeverity="low"
        lensStats={[
          { lensId: "correctness", issueCount: 6, status: "success" },
          { lensId: "security", issueCount: 6, status: "success" },
        ]}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(lastFrame() ?? "").not.toContain("4 below-threshold issues hidden");
    for (let index = 0; index < 30; index += 1) {
      stdin.write("\u001b[B");
      await new Promise((resolve) => setImmediate(resolve));
    }

    const frame = lastFrame() ?? "";
    expect(frame).toContain("4 below-threshold issues hidden");
    expect(frame).toContain("View Results (Enter)");
    expect(frame.split("\n")).toHaveLength(24);
  });

  test("paints every results list row and keeps the 80x24 frame stable while navigating", async () => {
    summaryContentZone.columns = 80;
    summaryContentZone.rows = 24;
    const issues = Array.from({ length: 12 }, (_, index) =>
      makeIssue({
        id: `results-floor-${index + 1}`,
        severity: index === 0 ? "blocker" : "high",
        file: `packages/review/src/generated/deeply/nested/results-floor-${index + 1}.typescript.ts`,
        title: `RESULTS-FLOOR-${index + 1} long diagnostic title`,
      }),
    );
    const { stdin, lastFrame } = renderRootFrame(
      80,
      24,
      <ReviewResultsView reviewId="results-floor" issues={issues} onBack={vi.fn()} />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("RESULTS-FLOOR-1"));
    const initialFrame = lastFrame() ?? "";
    const severityFilterRow = initialFrame.split("\n").find((row) => row.includes("B1 H11"));
    expect(severityFilterRow).toBeDefined();
    expect(severityFilterRow).not.toContain("[BLOCK");
    expect(initialFrame.split("\n")).toHaveLength(24);

    const paintedTitles = new Set(initialFrame.match(/RESULTS-FLOOR-\d+/g) ?? []);
    for (let index = 0; index < 11; index += 1) {
      stdin.write("\u001b[B");
      for (let render = 0; render < 4; render += 1) {
        await new Promise((resolve) => setImmediate(resolve));
      }
      expect(lastFrame()?.split("\n")).toHaveLength(24);
      for (const title of lastFrame()?.match(/RESULTS-FLOOR-\d+/g) ?? []) {
        paintedTitles.add(title);
      }
    }
    await vi.waitFor(() => expect(lastFrame()).toContain("RESULTS-FLOOR-12"));
    const finalFrame = lastFrame() ?? "";
    expect(paintedTitles).toEqual(
      new Set(Array.from({ length: 12 }, (_, index) => `RESULTS-FLOOR-${index + 1}`)),
    );
    expect(finalFrame).toContain("RESULTS-FLOOR-12");
    expect(lastFrame()?.split("\n")).toHaveLength(24);
  });

  test.each([
    80, 100,
  ] as const)("keeps the %i-column results heading, data, and actions in a 24-row root frame", async (columns) => {
    summaryContentZone.columns = columns;
    summaryContentZone.rows = 24;
    const { lastFrame } = renderRootFrame(
      columns,
      24,
      <ReviewResultsView
        reviewId="review-1"
        issues={[makeIssue({ id: "1", title: "Leaky state update" })]}
        onBack={vi.fn()}
      />,
    );

    await vi.waitFor(() => expect(lastFrame()).toContain("[Esc] Back"));
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Review #review-1");
    expect(frame).toContain("ISSUES (1)");
    expect(frame).toContain("Leaky state update");
    expect(frame.split("\n")).toHaveLength(24);
    expectNoRepeatedDividerRows(frame);
  });
});
