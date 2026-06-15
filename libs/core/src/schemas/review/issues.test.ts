import { describe, expect, it } from "vitest";
import { ReviewIssueSchema } from "./issues.js";

function createIssueInput(overrides: Record<string, unknown> = {}) {
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
    expect(ReviewIssueSchema.safeParse(createIssueInput()).success).toBe(true);
    expect(
      ReviewIssueSchema.safeParse(createIssueInput({ line_start: null, line_end: null })).success,
    ).toBe(true);
  });

  // Line constraints are provider-unenforceable, so the schema is lenient: zero,
  // negative, inverted, and line_end-without-line_start values parse and are
  // corrected by normalizeIssueLineFields on the write path (F-468/F-028).
  it("accepts non-positive line numbers without failing the parse", () => {
    expect(ReviewIssueSchema.safeParse(createIssueInput({ line_start: 0 })).success).toBe(true);
    expect(ReviewIssueSchema.safeParse(createIssueInput({ line_end: -1 })).success).toBe(true);
  });

  it("accepts line_end without line_start without failing the parse", () => {
    expect(
      ReviewIssueSchema.safeParse(createIssueInput({ line_start: null, line_end: 4 })).success,
    ).toBe(true);
  });

  it("accepts descending line ranges without failing the parse", () => {
    expect(
      ReviewIssueSchema.safeParse(createIssueInput({ line_start: 8, line_end: 7 })).success,
    ).toBe(true);
  });
});
