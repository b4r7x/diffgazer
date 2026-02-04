import type { TriageIssue, TriageResult, TriageSeverity } from "@stargazer/schemas/triage";

const SEVERITY_ORDER: Record<TriageSeverity, number> = {
  blocker: 0,
  high: 1,
  medium: 2,
  low: 3,
  nit: 4,
};

function deduplicateIssues(issues: TriageIssue[]): TriageIssue[] {
  const seen = new Map<string, TriageIssue>();

  for (const issue of issues) {
    // Key by file + line + title prefix for deduplication
    const key = `${issue.file}:${issue.line_start ?? 0}:${issue.title.toLowerCase().slice(0, 50)}`;
    const existing = seen.get(key);

    // Keep the more severe issue
    if (!existing || SEVERITY_ORDER[issue.severity] < SEVERITY_ORDER[existing.severity]) {
      seen.set(key, issue);
    }
  }

  return Array.from(seen.values());
}

function sortIssuesBySeverity(issues: TriageIssue[]): TriageIssue[] {
  return [...issues].sort((a, b) => {
    // Sort by severity first
    const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severityDiff !== 0) return severityDiff;

    // Then by confidence
    const confidenceDiff = b.confidence - a.confidence;
    if (Math.abs(confidenceDiff) > 0.01) return confidenceDiff;

    // Then by file
    return a.file.localeCompare(b.file);
  });
}

function generateExecutiveSummary(issues: TriageIssue[], lensSummaries: string[]): string {
  const severityCounts = issues.reduce((acc, issue) => {
    acc[issue.severity] = (acc[issue.severity] ?? 0) + 1;
    return acc;
  }, {} as Record<TriageSeverity, number>);

  const uniqueFiles = new Set(issues.map(i => i.file)).size;

  const severityLines = Object.entries(severityCounts)
    .sort(([a], [b]) => SEVERITY_ORDER[a as TriageSeverity] - SEVERITY_ORDER[b as TriageSeverity])
    .map(([severity, count]) => `- ${severity}: ${count}`)
    .join("\n");

  const summaryParts = [
    `Found ${issues.length} issue${issues.length !== 1 ? "s" : ""} across ${uniqueFiles} file${uniqueFiles !== 1 ? "s" : ""}.`,
    "",
    "Severity breakdown:",
    severityLines,
  ];

  if (lensSummaries.length > 0) {
    summaryParts.push("", "Lens summaries:", ...lensSummaries.map(s => `- ${s}`));
  }

  return summaryParts.join("\n");
}

export function generateReport(
  issues: TriageIssue[],
  lensSummaries: string[]
): TriageResult {
  const deduplicated = deduplicateIssues(issues);
  const sorted = sortIssuesBySeverity(deduplicated);
  const summary = generateExecutiveSummary(sorted, lensSummaries);

  return { summary, issues: sorted };
}
