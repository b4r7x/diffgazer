import { FooterProvider } from "@diffgazer/core/footer";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { cleanup, render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
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
