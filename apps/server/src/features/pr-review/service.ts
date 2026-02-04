import type { TriageIssue, TriageSeverity } from "@repo/schemas/triage";
import type { AnnotationLevel, GitHubAnnotation, InlineComment, PRReviewResponse } from "./types.js";

const severityToAnnotationLevel = (severity: TriageSeverity): AnnotationLevel => {
  switch (severity) {
    case "blocker":
    case "high":
      return "failure";
    case "medium":
      return "warning";
    case "low":
    case "nit":
      return "notice";
  }
};

const issueToAnnotation = (issue: TriageIssue): GitHubAnnotation | null => {
  if (issue.line_start === null) {
    return null;
  }

  return {
    path: issue.file,
    start_line: issue.line_start,
    end_line: issue.line_end ?? issue.line_start,
    annotation_level: severityToAnnotationLevel(issue.severity),
    message: `${issue.rationale}\n\nRecommendation: ${issue.recommendation}`,
    title: `[${issue.severity.toUpperCase()}] ${issue.title}`,
  };
};

const severityEmoji: Record<TriageSeverity, string> = {
  blocker: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
  nit: "⚪",
};

const issueToInlineComment = (issue: TriageIssue): InlineComment | null => {
  if (!issue.file || !issue.line_start) return null;

  const body = [
    `${severityEmoji[issue.severity]} **${issue.severity.toUpperCase()}**: ${issue.title}`,
    "",
    issue.symptom || issue.rationale,
    "",
    issue.recommendation ? `**Suggestion:** ${issue.recommendation}` : "",
    issue.suggested_patch ? `\`\`\`suggestion\n${issue.suggested_patch}\n\`\`\`` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    path: issue.file,
    line: issue.line_start,
    side: "RIGHT",
    body,
  };
};

const issueToSimplified = (issue: TriageIssue) => ({
  severity: issue.severity,
  title: issue.title,
  file: issue.file,
  line: issue.line_start ?? 0,
  message: issue.rationale,
  suggestion: issue.suggested_patch ?? undefined,
});

export const buildPrReviewResponse = (
  issues: TriageIssue[],
  summaries: string[]
): PRReviewResponse => {
  const annotations = issues
    .map(issueToAnnotation)
    .filter((annotation): annotation is GitHubAnnotation => annotation !== null);

  const inlineComments = issues
    .map(issueToInlineComment)
    .filter((comment): comment is InlineComment => comment !== null);

  return {
    summary: summaries.join("\n\n"),
    issues: issues.map(issueToSimplified),
    annotations,
    inlineComments,
  };
};
