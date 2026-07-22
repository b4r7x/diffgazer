import { severityRank } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue, ReviewSeverity, SeverityFilter } from "@diffgazer/core/schemas/review";

export function severityMeetsMinimum(
  severity: ReviewSeverity,
  minSeverity: ReviewSeverity,
): boolean {
  return severityRank(severity) <= severityRank(minSeverity);
}

export function filterIssuesByMinSeverity(
  issues: ReviewIssue[],
  filter?: SeverityFilter,
): ReviewIssue[] {
  if (!filter) return issues;
  return issues.filter((issue) => severityMeetsMinimum(issue.severity, filter.minSeverity));
}

export function deduplicateIssues(issues: ReviewIssue[]): ReviewIssue[] {
  const seen = new Map<string, ReviewIssue>();

  for (const issue of issues) {
    const key = JSON.stringify([
      issue.title.toLowerCase(),
      issue.file,
      issue.line_start,
      issue.line_end,
      issue.category,
    ]);
    const existing = seen.get(key);

    if (!existing || severityRank(issue.severity) < severityRank(existing.severity)) {
      seen.set(key, issue);
    }
  }

  return Array.from(seen.values());
}

export function sortIssuesBySeverity(issues: ReviewIssue[]): ReviewIssue[] {
  return [...issues].sort((a, b) => {
    const severityDiff = severityRank(a.severity) - severityRank(b.severity);
    if (severityDiff !== 0) return severityDiff;

    const confidenceBucketDiff = Math.round(b.confidence * 100) - Math.round(a.confidence * 100);
    if (confidenceBucketDiff !== 0) return confidenceBucketDiff;

    const confidenceDiff = b.confidence - a.confidence;
    if (confidenceDiff !== 0) return confidenceDiff;

    const fileDiff = a.file.localeCompare(b.file);
    if (fileDiff !== 0) return fileDiff;

    return a.id.localeCompare(b.id);
  });
}
