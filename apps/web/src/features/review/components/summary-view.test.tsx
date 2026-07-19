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
  droppedDuplicates?: number;
  minSeverity?: ReviewIssue["severity"];
  lensStats?: LensStat[];
  issues?: ReviewIssue[];
  reviewId?: string | null;
  durationMs?: number;
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
          onBack={vi.fn()}
        />
      </FooterProvider>
    </KeyboardProvider>,
  );
}

describe("ReviewSummaryView", () => {
  it("shortens the run id in the heading", () => {
    renderSummary({ reviewId: "7685a1b2-0000-4000-8000-000000000000" });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Review Complete #7685");
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(3);
    expect(screen.getByRole("heading", { level: 2, name: "Severity Breakdown" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Issues by Category" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: /top issues preview/i })).toBeVisible();
  });

  it("falls back to #unknown in the heading when the review id is missing", () => {
    renderSummary({ reviewId: null });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Review Complete #unknown");
  });

  it("renders the persisted review duration beside the summary totals", () => {
    renderSummary({ durationMs: 2500 });

    expect(screen.getByText("Duration:").parentElement).toHaveTextContent("Duration: 2.5s");
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
    expect(within(table).getByText("failed (CANCELLED)")).toBeInTheDocument();
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

    expect(screen.getByText("src/db.ts")).toBeInTheDocument();
    expect(screen.queryByText("src/db.ts:0")).not.toBeInTheDocument();
  });
});
