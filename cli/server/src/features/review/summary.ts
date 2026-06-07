import { calculateSeverityCounts, severityRank } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue, ReviewResult, ReviewSeverity } from "@diffgazer/core/schemas/review";
import { pluralize } from "@diffgazer/core/strings";

export function generateExecutiveSummary(
  issues: ReviewIssue[],
  orchestrationSummary: string,
): string {
  const severityCounts = calculateSeverityCounts(issues);

  const uniqueFiles = new Set(issues.map((i) => i.file)).size;

  const severityLines = Object.entries(severityCounts)
    .sort(([a], [b]) => severityRank(a as ReviewSeverity) - severityRank(b as ReviewSeverity))
    .map(([severity, count]) => `- ${severity}: ${count}`)
    .join("\n");

  const summaryParts = [
    `Found ${pluralize(issues.length, "issue")} across ${pluralize(uniqueFiles, "file")}.`,
    "",
    "Severity breakdown:",
    severityLines,
  ];

  if (orchestrationSummary) {
    summaryParts.push("", orchestrationSummary);
  }

  return summaryParts.join("\n");
}

export function generateReport(issues: ReviewIssue[], orchestrationSummary: string): ReviewResult {
  const summary = generateExecutiveSummary(issues, orchestrationSummary);
  return { summary, issues };
}
