import { FooterProvider } from "@diffgazer/core/footer";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { cleanup, render } from "ink-testing-library";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { NavigationProvider } from "../../../app/providers/navigation-provider";
import { GlobalLayout } from "../../../components/layout/global";
import { CliThemeProvider } from "../../../theme/provider";
import { ReviewResultsView } from "./results-view";
import { ReviewSummaryView } from "./summary-view";

const terminalDimensions = vi.hoisted(() => ({ current: { columns: 80, rows: 24 } }));

vi.mock("@diffgazer/core/api/hooks", () => ({
  useInit: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useTerminalDimensions: () => terminalDimensions.current,
  useResponsive: () => ({
    ...terminalDimensions.current,
    tier: "medium",
    isNarrow: false,
    isMedium: true,
    isWide: false,
  }),
}));

afterEach(() => {
  cleanup();
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

function renderRootFrame(columns: 80 | 100, child: ReactNode) {
  terminalDimensions.current = { columns, rows: 24 };
  return render(
    <NavigationProvider>
      <FooterProvider initialShortcuts={[]}>
        <CliThemeProvider initialTheme="dark">
          <GlobalLayout>{child}</GlobalLayout>
        </CliThemeProvider>
      </FooterProvider>
    </NavigationProvider>,
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

  test.each([
    80, 100,
  ] as const)("keeps the %i-column summary heading, data, and actions in a 24-row root frame", async (columns) => {
    const issue = makeIssue({ id: "1", severity: "high", title: "Leaky state update" });
    const { lastFrame } = renderRootFrame(
      columns,
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
    const issues = Array.from({ length: 3 }, (_, index) =>
      makeIssue({
        id: `summary-${index + 1}`,
        file: `packages/review/src/generated/deeply/nested/summary-${index + 1}.typescript.ts`,
        title: `SUMMARY-${index + 1} Generated review title with enough detail to overflow its preview row`,
      }),
    );
    const { lastFrame } = renderRootFrame(
      100,
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

  test.each([
    80, 100,
  ] as const)("keeps the %i-column results heading, data, and actions in a 24-row root frame", async (columns) => {
    const { lastFrame } = renderRootFrame(
      columns,
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
