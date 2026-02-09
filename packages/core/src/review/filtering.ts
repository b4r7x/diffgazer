import type { ReviewIssue, ReviewSeverity } from "@diffgazer/schemas/review";

/**
 * Filter issues by severity level
 */
export function filterIssuesBySeverity(
  issues: ReviewIssue[],
  severityFilter: ReviewSeverity | "all"
): ReviewIssue[] {
  if (severityFilter === "all") {
    return issues;
  }
  return issues.filter((issue) => issue.severity === severityFilter);
}
