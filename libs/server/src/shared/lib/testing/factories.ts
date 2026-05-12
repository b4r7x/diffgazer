import type { ReviewIssue } from "@diffgazer/core/schemas/review";

export function makeIssue(overrides: Partial<ReviewIssue> = {}): ReviewIssue {
  return {
    id: "issue-1",
    severity: "high",
    category: "correctness",
    title: "Test issue",
    file: "src/index.ts",
    line_start: 10,
    line_end: 15,
    rationale: "test rationale",
    recommendation: "test recommendation",
    suggested_patch: null,
    confidence: 0.9,
    symptom: "test symptom",
    whyItMatters: "test explanation",
    evidence: [],
    enrichment: undefined,
    ...overrides,
  };
}
