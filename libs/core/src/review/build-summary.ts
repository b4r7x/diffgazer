import type { LensStat } from "../schemas/events/index.js";
import {
  type CategoryStats,
  calculateSeverityCounts,
  type SeverityCounts,
} from "../schemas/presentation/index.js";
import type { ReviewIssue, ReviewSeverity } from "../schemas/review/index.js";
import { capitalize, pluralize } from "../strings.js";

export interface ReviewSummary {
  severityCounts: SeverityCounts;
  filesAnalyzed: number;
  blockerCount: number;
  total: number;
}

export function buildReviewSummary(issues: ReviewIssue[]): ReviewSummary {
  const severityCounts = calculateSeverityCounts(issues);
  const filesAnalyzed = new Set(issues.map((issue) => issue.file)).size;
  return {
    severityCounts,
    filesAnalyzed,
    blockerCount: severityCounts.blocker,
    total: issues.length,
  };
}

/**
 * Builds the "K below-threshold issue(s) hidden (threshold: X)" notice for the
 * summary screen, or null when no issues were dropped below the severity
 * threshold. The streamed counter ticks for solicited nits that the final result
 * drops, so surfacing the count and the floor that hid them keeps the result
 * honest and tells the user which threshold to lower.
 */
export function buildHiddenIssuesNotice(
  droppedBelowThreshold: number | undefined,
  minSeverity: ReviewSeverity | undefined,
): string | null {
  if (!droppedBelowThreshold || droppedBelowThreshold <= 0) return null;
  const hidden = `${pluralize(droppedBelowThreshold, "below-threshold issue")} hidden`;
  return minSeverity ? `${hidden} (threshold: ${minSeverity})` : hidden;
}

export interface LensSummaryRow {
  lensId: string;
  label: string;
  issueCount: number;
  status: "success" | "failed";
  errorCode?: string;
}

/** Maps persisted per-lens stats into display rows (label + status + error code). */
export function buildLensSummaryRows(lensStats: LensStat[] | undefined): LensSummaryRow[] {
  if (!lensStats) return [];
  return lensStats.map((stat) => ({
    lensId: stat.lensId,
    label: capitalize(stat.lensId),
    issueCount: stat.issueCount,
    status: stat.status,
    errorCode: stat.errorCode,
  }));
}

export function buildCategoryStats(issues: ReviewIssue[]): CategoryStats[] {
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
