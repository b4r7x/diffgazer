import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RunReceiptRow } from "@/components/shared/run-receipt";
import { ReviewCompleteSummary } from "./complete-summary";

const RECEIPT_ROWS: RunReceiptRow[] = [
  { label: "Scope", value: "Unstaged · 12 files · +248 -96" },
  { label: "Elapsed", value: "8s" },
];
const RECEIPT_STUB: RunReceiptRow = { label: "Run", value: "#run-1 · Today 2:02 PM" };

describe("ReviewCompleteSummary", () => {
  it("uses the singular issue label for a one-issue review", () => {
    render(
      <ReviewCompleteSummary
        stats={{ totalIssues: 1, filesWithIssues: 1, blockerCount: 0 }}
        severityCounts={{ blocker: 0, high: 1, medium: 0, low: 0, nit: 0 }}
        categoryStats={[]}
        topIssues={[]}
        receiptRows={RECEIPT_ROWS}
        receiptStub={RECEIPT_STUB}
      />,
    );

    expect(screen.getByText("1 issue in 1 file")).toBeVisible();
    expect(screen.queryByText(/1 issues/)).not.toBeInTheDocument();
    expect(screen.queryByText(/analyzed/i)).not.toBeInTheDocument();
  });

  it("states the run's evidence as a receipt and keeps the id out of the headline", () => {
    render(
      <ReviewCompleteSummary
        stats={{ totalIssues: 1, filesWithIssues: 1, blockerCount: 0 }}
        severityCounts={{ blocker: 0, high: 1, medium: 0, low: 0, nit: 0 }}
        categoryStats={[]}
        topIssues={[]}
        receiptRows={RECEIPT_ROWS}
        receiptStub={RECEIPT_STUB}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Review Complete");
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveTextContent("#run-1");
    expect(screen.getByText("Unstaged · 12 files · +248 -96")).toBeVisible();
    expect(screen.getByText("#run-1 · Today 2:02 PM")).toBeVisible();
    // Elapsed is the ledger's row now, so the fact line does not say it twice.
    expect(screen.getByText("1 issue in 1 file")).toBeVisible();
  });

  it("draws no breakdown or category table for a run that found nothing", () => {
    render(
      <ReviewCompleteSummary
        stats={{ totalIssues: 0, filesWithIssues: 0, blockerCount: 0 }}
        severityCounts={{ blocker: 0, high: 0, medium: 0, low: 0, nit: 0 }}
        categoryStats={[]}
        topIssues={[]}
        receiptRows={RECEIPT_ROWS}
        receiptStub={RECEIPT_STUB}
        lensStats={[
          { lensId: "correctness", issueCount: 0, status: "success" },
          { lensId: "security", issueCount: 0, status: "failed", errorCode: "STREAM_ERROR" },
        ]}
      />,
    );

    // A chart of zeros is a shape with no reading, and a table with no rows
    // costs a frame to say nothing.
    expect(screen.queryByRole("region", { name: "Severity breakdown" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Issues by category" })).not.toBeInTheDocument();
    expect(screen.queryByText("Nothing to categorise.")).not.toBeInTheDocument();
  });

  it("tabulates the categories a run did find", () => {
    render(
      <ReviewCompleteSummary
        stats={{ totalIssues: 2, filesWithIssues: 1, blockerCount: 0 }}
        severityCounts={{ blocker: 0, high: 0, medium: 2, low: 0, nit: 0 }}
        categoryStats={[{ id: "performance", name: "Performance", count: 2 }]}
        topIssues={[]}
        receiptRows={RECEIPT_ROWS}
        receiptStub={RECEIPT_STUB}
      />,
    );

    expect(screen.getByRole("cell", { name: "Performance" })).toBeVisible();
  });

  it("frames a partial run in the warning tone, never success-green", () => {
    render(
      <ReviewCompleteSummary
        stats={{ totalIssues: 0, filesWithIssues: 0, blockerCount: 0 }}
        severityCounts={{ blocker: 0, high: 0, medium: 0, low: 0, nit: 0 }}
        categoryStats={[]}
        topIssues={[]}
        receiptRows={RECEIPT_ROWS}
        receiptStub={RECEIPT_STUB}
        lensStats={[
          { lensId: "correctness", issueCount: 0, status: "success" },
          { lensId: "security", issueCount: 0, status: "failed", errorCode: "STREAM_ERROR" },
        ]}
      />,
    );

    // The Panel's rendered tone attribute is the documented contract: the frame
    // must agree with the "Partially Complete" headline instead of painting a
    // pass.
    expect(screen.getByRole("region", { name: "Run status" })).toHaveAttribute(
      "data-tone",
      "warning",
    );
    // A lens that never reported cannot make "No issues found" a pass, so the
    // fact line under the warning headline must not carry the success colour.
    expect(screen.getByText(/^No issues found/)).not.toHaveClass("text-success-text");
  });

  it("headlines a run with an incompletely-answered lens as partially complete in the warning frame", () => {
    render(
      <ReviewCompleteSummary
        stats={{ totalIssues: 3, filesWithIssues: 2, blockerCount: 0 }}
        severityCounts={{ blocker: 0, high: 0, medium: 3, low: 0, nit: 0 }}
        categoryStats={[]}
        topIssues={[]}
        receiptRows={RECEIPT_ROWS}
        receiptStub={RECEIPT_STUB}
        lensStats={[
          { lensId: "correctness", issueCount: 3, status: "success", droppedCandidateCount: 4 },
          { lensId: "security", issueCount: 0, status: "success" },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Review Partially Complete",
    );
    // The frame follows the headline: no failed lens, but no success-green either.
    expect(screen.getByRole("region", { name: "Run status" })).toHaveAttribute(
      "data-tone",
      "warning",
    );
  });

  it("keeps the success frame for a fully reported run", () => {
    render(
      <ReviewCompleteSummary
        stats={{ totalIssues: 1, filesWithIssues: 1, blockerCount: 0 }}
        severityCounts={{ blocker: 0, high: 1, medium: 0, low: 0, nit: 0 }}
        categoryStats={[]}
        topIssues={[]}
        receiptRows={RECEIPT_ROWS}
        receiptStub={RECEIPT_STUB}
        lensStats={[{ lensId: "correctness", issueCount: 1, status: "success" }]}
      />,
    );

    expect(screen.getByRole("region", { name: "Run status" })).toHaveAttribute(
      "data-tone",
      "success",
    );
  });

  it("names the run status and top issues panels for assistive tech", () => {
    render(
      <ReviewCompleteSummary
        stats={{ totalIssues: 1, filesWithIssues: 1, blockerCount: 0 }}
        severityCounts={{ blocker: 0, high: 1, medium: 0, low: 0, nit: 0 }}
        categoryStats={[]}
        topIssues={[
          {
            id: "1",
            title: "Unchecked response",
            file: "src/api.ts",
            category: "correctness",
            severity: "high",
          },
        ]}
        receiptRows={RECEIPT_ROWS}
        receiptStub={RECEIPT_STUB}
      />,
    );

    expect(screen.getByRole("region", { name: "Run status" })).toBeVisible();
    const preview = screen.getByRole("region", { name: "Top Issues Preview" });
    expect(within(preview).getByText("Unchecked response")).toBeVisible();
  });
});
