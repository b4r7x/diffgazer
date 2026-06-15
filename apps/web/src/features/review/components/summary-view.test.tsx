import { FooterProvider } from "@diffgazer/core/footer";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Boundary mock: TanStack Router is the external routing library; summary footer/back behavior reads router state.
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ history: { back: vi.fn() }, navigate: vi.fn() }),
  useCanGoBack: () => false,
  useLocation: () => ({ pathname: "/review/test-id" }),
}));

import { ReviewSummaryView } from "./summary-view";

function renderSummary(props?: {
  droppedBelowThreshold?: number;
  minSeverity?: ReviewIssue["severity"];
  lensStats?: LensStat[];
}) {
  return render(
    <KeyboardProvider>
      <FooterProvider>
        <ReviewSummaryView
          issues={[makeIssue({ id: "1", severity: "high", title: "Issue 1" })]}
          reviewId="review-1"
          droppedBelowThreshold={props?.droppedBelowThreshold}
          minSeverity={props?.minSeverity}
          lensStats={props?.lensStats}
          onEnterReview={vi.fn()}
          onBack={vi.fn()}
        />
      </FooterProvider>
    </KeyboardProvider>,
  );
}

describe("ReviewSummaryView", () => {
  it("renders the hidden-count notice naming the severity threshold", () => {
    renderSummary({ droppedBelowThreshold: 3, minSeverity: "low" });

    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("3 below-threshold issues hidden (threshold: low)");
  });

  it("renders the per-lens stats table including a failed lens error code", () => {
    renderSummary({
      lensStats: [
        { lensId: "correctness", issueCount: 2, status: "success" },
        { lensId: "security", issueCount: 0, status: "failed", errorCode: "CANCELLED" },
      ],
    });

    const table = screen.getByRole("table", { name: /issues by lens/i });
    expect(within(table).getByText("Correctness")).toBeInTheDocument();
    expect(within(table).getByText("2")).toBeInTheDocument();
    expect(within(table).getByText("Security")).toBeInTheDocument();
    expect(within(table).getByText("failed (CANCELLED)")).toBeInTheDocument();
  });

  it("omits the hidden-count notice when nothing was dropped", () => {
    renderSummary();

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});
