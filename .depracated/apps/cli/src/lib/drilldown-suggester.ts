import type { TriageIssue } from "@repo/schemas";

const UNCERTAINTY_PATTERNS = ["might", "possibly", "unclear", "could be"] as const;

const HIGH_SEVERITY = ["blocker", "high"] as const;
const CONFIDENCE_THRESHOLD = 0.8;

function hasUncertainRationale(rationale: string): boolean {
  const lowerRationale = rationale.toLowerCase();
  return UNCERTAINTY_PATTERNS.some((pattern) => lowerRationale.includes(pattern));
}

export function shouldSuggestDrilldown(issue: TriageIssue): boolean {
  if (HIGH_SEVERITY.includes(issue.severity as (typeof HIGH_SEVERITY)[number])) {
    return true;
  }

  if (issue.confidence < CONFIDENCE_THRESHOLD) {
    return true;
  }

  if (issue.category === "security") {
    return true;
  }

  if (hasUncertainRationale(issue.rationale)) {
    return true;
  }

  return false;
}

export function getSuggestionReason(issue: TriageIssue): string {
  if (issue.severity === "blocker") {
    return "This BLOCKER severity issue could benefit from deeper analysis.";
  }

  if (issue.category === "security") {
    return "This security issue should be verified with full context.";
  }

  if (issue.severity === "high" && issue.confidence < CONFIDENCE_THRESHOLD) {
    const confidencePercent = Math.round(issue.confidence * 100);
    return `This HIGH severity issue has low confidence (${confidencePercent}%). Want me to analyze deeper?`;
  }

  if (issue.severity === "high") {
    return "This HIGH severity issue could benefit from deeper analysis.";
  }

  if (issue.confidence < CONFIDENCE_THRESHOLD) {
    const confidencePercent = Math.round(issue.confidence * 100);
    return `This issue has low confidence (${confidencePercent}%). Deeper context may help clarify.`;
  }

  if (hasUncertainRationale(issue.rationale)) {
    return "The analysis is uncertain about this issue. Deeper context may help.";
  }

  return "This issue may benefit from deeper analysis.";
}
