import type { ReviewIssue } from "@repo/schemas/review";
import type { TriageIssue } from "@repo/schemas/triage";

export function adaptReviewIssueToTriageIssue(
  issue: ReviewIssue,
  index: number
): TriageIssue {
  return {
    id: `review-issue-${index}`,
    severity: mapReviewSeverityToTriage(issue.severity),
    category: mapReviewCategoryToTriage(issue.category),
    title: issue.title,
    file: issue.file ?? "unknown",
    line_start: issue.line,
    line_end: issue.line,
    rationale: issue.description,
    recommendation: issue.suggestion ?? "",
    suggested_patch: null,
    confidence: 0.8,
    symptom: issue.description,
    whyItMatters: issue.description,
    evidence: [],
    trace: [],
  };
}

export function mapReviewSeverityToTriage(
  severity: "critical" | "warning" | "suggestion" | "nitpick"
): TriageIssue["severity"] {
  const map: Record<typeof severity, TriageIssue["severity"]> = {
    critical: "blocker",
    warning: "high",
    suggestion: "medium",
    nitpick: "nit",
  };
  return map[severity];
}

export function mapReviewCategoryToTriage(
  category: "security" | "performance" | "style" | "logic" | "documentation" | "best-practice"
): TriageIssue["category"] {
  const map: Record<typeof category, TriageIssue["category"]> = {
    security: "security",
    performance: "performance",
    style: "style",
    logic: "correctness",
    documentation: "readability",
    "best-practice": "correctness",
  };
  return map[category];
}

export function issueMatchesPattern(issue: TriageIssue, pattern: string): boolean {
  const lowerPattern = pattern.toLowerCase();
  return (
    issue.title.toLowerCase().includes(lowerPattern) ||
    issue.category.toLowerCase().includes(lowerPattern) ||
    issue.file.toLowerCase().includes(lowerPattern) ||
    issue.rationale.toLowerCase().includes(lowerPattern)
  );
}

export function filterIssues(
  issues: TriageIssue[],
  activeFilter: string | null,
  ignoredPatterns: string[]
): TriageIssue[] {
  let filtered = issues;

  if (ignoredPatterns.length > 0) {
    filtered = filtered.filter(
      (issue) => !ignoredPatterns.some((pattern) => issueMatchesPattern(issue, pattern))
    );
  }

  if (activeFilter) {
    const matching: TriageIssue[] = [];
    const nonMatching: TriageIssue[] = [];
    for (const issue of filtered) {
      if (issueMatchesPattern(issue, activeFilter)) {
        matching.push(issue);
      } else {
        nonMatching.push(issue);
      }
    }
    filtered = [...matching, ...nonMatching];
  }

  return filtered;
}
