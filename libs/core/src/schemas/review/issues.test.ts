import { describe, expect, it } from "vitest";
import { ReviewIssueSchema } from "./issues.js";

function makeIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: "issue-1",
    severity: "high",
    category: "correctness",
    title: "Issue title",
    file: "src/app.ts",
    line_start: 10,
    line_end: 12,
    rationale: "Because reasons",
    recommendation: "Do the thing",
    suggested_patch: null,
    confidence: 0.8,
    symptom: "A bad thing happens",
    whyItMatters: "It matters",
    evidence: [],
    ...overrides,
  };
}

describe("ReviewIssueSchema", () => {
  it("accepts valid line ranges", () => {
    expect(ReviewIssueSchema.safeParse(makeIssue()).success).toBe(true);
    expect(
      ReviewIssueSchema.safeParse(makeIssue({ line_start: null, line_end: null })).success,
    ).toBe(true);
  });

  it("rejects non-positive line numbers", () => {
    expect(ReviewIssueSchema.safeParse(makeIssue({ line_start: 0 })).success).toBe(false);
    expect(ReviewIssueSchema.safeParse(makeIssue({ line_end: -1 })).success).toBe(false);
  });

  it("rejects line_end without line_start", () => {
    expect(ReviewIssueSchema.safeParse(makeIssue({ line_start: null, line_end: 4 })).success).toBe(
      false,
    );
  });

  it("rejects descending line ranges", () => {
    expect(ReviewIssueSchema.safeParse(makeIssue({ line_start: 8, line_end: 7 })).success).toBe(
      false,
    );
  });
});
