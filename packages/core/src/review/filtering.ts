import type { TriageIssue, TriageSeverity } from "@stargazer/schemas/triage";

/**
 * Check if an issue matches a text pattern (case-insensitive search across key fields)
 */
export function issueMatchesPattern(issue: TriageIssue, pattern: string): boolean {
  const lowerPattern = pattern.toLowerCase();
  return (
    issue.title.toLowerCase().includes(lowerPattern) ||
    issue.category.toLowerCase().includes(lowerPattern) ||
    issue.file.toLowerCase().includes(lowerPattern) ||
    issue.rationale.toLowerCase().includes(lowerPattern)
  );
}

/**
 * Filter issues by text pattern and ignored patterns.
 * Matching issues are sorted to the top when activeFilter is provided.
 */
export function filterIssuesByPattern(
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

/**
 * Filter issues by severity level
 */
export function filterIssuesBySeverity(
  issues: TriageIssue[],
  severityFilter: TriageSeverity | "all"
): TriageIssue[] {
  if (severityFilter === "all") {
    return issues;
  }
  return issues.filter((issue) => issue.severity === severityFilter);
}

/**
 * Combined filter: applies pattern filtering then severity filtering
 */
export function filterIssues(
  issues: TriageIssue[],
  options: {
    activeFilter?: string | null;
    ignoredPatterns?: string[];
    severityFilter?: TriageSeverity | "all";
  }
): TriageIssue[] {
  const { activeFilter = null, ignoredPatterns = [], severityFilter = "all" } = options;

  const patternFiltered = filterIssuesByPattern(issues, activeFilter, ignoredPatterns);
  return filterIssuesBySeverity(patternFiltered, severityFilter);
}
