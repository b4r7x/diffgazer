import type { ReviewIssue, ReviewSeverity } from "@diffgazer/core/schemas/review";

export function filterIssuesBySeverity(
  issues: ReviewIssue[],
  severityFilter: ReadonlySet<ReviewSeverity>
): ReviewIssue[] {
  if (severityFilter.size === 0) {
    return issues;
  }
  return issues.filter((issue) => severityFilter.has(issue.severity));
}
