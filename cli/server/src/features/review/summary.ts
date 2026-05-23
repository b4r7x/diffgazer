import type {
  ReviewIssue,
  ReviewResult,
  ReviewSeverity,
} from "@diffgazer/core/schemas/review";
import { severityRank } from "@diffgazer/core/schemas/presentation";

export function generateExecutiveSummary(
  issues: ReviewIssue[],
  orchestrationSummary: string,
): string {
  const severityCounts: Record<ReviewSeverity, number> = {
    blocker: 0,
    high: 0,
    medium: 0,
    low: 0,
    nit: 0,
  };
  for (const issue of issues) {
    severityCounts[issue.severity]++;
  }

  const uniqueFiles = new Set(issues.map((i) => i.file)).size;

  const severityLines = Object.entries(severityCounts)
    .sort(
      ([a], [b]) =>
        severityRank(a as ReviewSeverity) - severityRank(b as ReviewSeverity),
    )
    .map(([severity, count]) => `- ${severity}: ${count}`)
    .join("\n");

  const summaryParts = [
    `Found ${issues.length} issue${issues.length !== 1 ? "s" : ""} across ${uniqueFiles} file${uniqueFiles !== 1 ? "s" : ""}.`,
    "",
    "Severity breakdown:",
    severityLines,
  ];

  if (orchestrationSummary) {
    summaryParts.push("", orchestrationSummary);
  }

  return summaryParts.join("\n");
}

export function generateReport(
  issues: ReviewIssue[],
  orchestrationSummary: string,
): ReviewResult {
  const summary = generateExecutiveSummary(issues, orchestrationSummary);
  return { summary, issues };
}
