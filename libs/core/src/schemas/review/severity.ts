import { REVIEW_SEVERITY, type ReviewSeverity } from "./enums.js";

// Ranking and counting are review-domain operations: the daemon uses them for
// threshold resolution, issue ordering, and persisted counts. Only labels and
// the UI filter state belong to the presentation layer.

// Lower rank = more severe (matches index in REVIEW_SEVERITY).
export const severityRank = (severity: ReviewSeverity): number => REVIEW_SEVERITY.indexOf(severity);

export interface SeverityCounts {
  blocker: number;
  high: number;
  medium: number;
  low: number;
  nit: number;
}

export function calculateSeverityCounts(issues: { severity: ReviewSeverity }[]): SeverityCounts {
  const counts: SeverityCounts = { blocker: 0, high: 0, medium: 0, low: 0, nit: 0 };
  for (const issue of issues) {
    counts[issue.severity]++;
  }
  return counts;
}
