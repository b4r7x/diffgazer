import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import type { ReviewMetadata } from "@diffgazer/core/schemas/review";

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

export function makeReview(overrides: Partial<ReviewMetadata> = {}): ReviewMetadata {
  return {
    id: "review-1",
    projectPath: "/repo",
    createdAt: "2026-02-09T12:00:00.000Z",
    mode: "unstaged",
    branch: "main",
    profile: null,
    lenses: [],
    issueCount: 0,
    blockerCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    nitCount: 0,
    fileCount: 1,
    durationMs: 1200,
    ...overrides,
  };
}
