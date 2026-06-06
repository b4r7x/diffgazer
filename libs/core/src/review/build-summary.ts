import {
  calculateSeverityCounts,
  type LensStats,
  type SeverityCounts,
} from "../schemas/presentation/index.js";
import type { ReviewIssue } from "../schemas/review/index.js";
import { capitalize } from "../strings.js";

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

export function buildLensStats(issues: ReviewIssue[]): LensStats[] {
  const counts: Record<string, number> = {};
  for (const issue of issues) {
    counts[issue.category] = (counts[issue.category] ?? 0) + 1;
  }
  return Object.entries(counts).map(([category, count]) => ({
    id: category,
    name: capitalize(category),
    icon: "",
    count,
    change: 0,
  }));
}
