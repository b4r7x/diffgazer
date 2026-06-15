import { FooterProvider } from "@diffgazer/core/footer";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";

import { CliThemeProvider } from "../../../theme/provider";
import { ReviewSummaryView } from "./summary-view";

afterEach(() => {
  cleanup();
});

function renderSummary(props?: {
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
});
