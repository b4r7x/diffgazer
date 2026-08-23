import type { ReviewIssue, ReviewSeverity } from "../schemas/review/index.js";

export function filterIssuesBySeverity(
  issues: ReviewIssue[],
  severityFilter: ReadonlySet<ReviewSeverity>,
): ReviewIssue[] {
  if (severityFilter.size === 0) {
    return issues;
  }
  return issues.filter((issue) => severityFilter.has(issue.severity));
}

export function toggleSeverity(
  filter: ReadonlySet<ReviewSeverity>,
  severity: ReviewSeverity,
): Set<ReviewSeverity> {
  const next = new Set(filter);
  if (next.has(severity)) next.delete(severity);
  else next.add(severity);
  return next;
}
