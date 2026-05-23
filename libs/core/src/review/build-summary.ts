import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { calculateSeverityCounts, type SeverityCounts } from "@diffgazer/core/schemas/presentation";

export interface ReviewSummary {
  severityCounts: SeverityCounts;
  filesAnalyzed: number;
  criticalCount: number;
  total: number;
}

export function buildReviewSummary(issues: ReviewIssue[]): ReviewSummary {
  const severityCounts = calculateSeverityCounts(issues);
  const filesAnalyzed = new Set(issues.map((issue) => issue.file)).size;
  return {
    severityCounts,
    filesAnalyzed,
    criticalCount: severityCounts.blocker,
    total: issues.length,
  };
}
