import { SEVERITY_ORDER } from "../../schemas/presentation/index.js";
import type { ReviewIssue } from "../../schemas/review/index.js";

/** Orders review issues by descending severity, preserving original order within a tier. */
export function sortIssuesBySeverity(issues: readonly ReviewIssue[] | undefined): ReviewIssue[] {
  if (!issues || issues.length === 0) return [];
  return [...issues].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
}
