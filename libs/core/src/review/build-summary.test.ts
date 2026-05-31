import { describe, expect, it } from "vitest";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { buildReviewSummary } from "./build-summary.js";

function makeIssue(overrides: Partial<ReviewIssue> & Pick<ReviewIssue, "id" | "severity">): ReviewIssue {
  return {
    title: "Issue",
    category: "correctness",
    file: "src/a.ts",
    line_start: 1,
    line_end: null,
    rationale: "",
    recommendation: "",
    suggested_patch: null,
    confidence: 0.9,
    symptom: "",
    whyItMatters: "",
    evidence: [],
    ...overrides,
  } as ReviewIssue;
}

describe("buildReviewSummary", () => {
  it("returns zeroed summary for an empty list", () => {
    const summary = buildReviewSummary([]);
    expect(summary).toEqual({
      severityCounts: { blocker: 0, high: 0, medium: 0, low: 0, nit: 0 },
      filesAnalyzed: 0,
      criticalCount: 0,
      total: 0,
    });
  });

  it("counts unique files and tracks blocker count as critical", () => {
    const issues: ReviewIssue[] = [
      makeIssue({ id: "1", severity: "blocker", file: "a.ts" }),
      makeIssue({ id: "2", severity: "blocker", file: "a.ts" }),
      makeIssue({ id: "3", severity: "high", file: "b.ts" }),
      makeIssue({ id: "4", severity: "low", file: "c.ts" }),
    ];

    const summary = buildReviewSummary(issues);

    expect(summary.total).toBe(4);
    expect(summary.filesAnalyzed).toBe(3);
    expect(summary.criticalCount).toBe(2);
    expect(summary.severityCounts).toEqual({
      blocker: 2,
      high: 1,
      medium: 0,
      low: 1,
      nit: 0,
    });
  });
});
