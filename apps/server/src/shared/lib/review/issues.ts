import { SEVERITY_ORDER, severityRank } from "@stargazer/core";
import type {
  ReviewIssue,
  ReviewSeverity,
  EvidenceRef,
  SeverityFilter,
} from "@stargazer/schemas/review";
import type { ParsedDiff, FileDiff, DiffHunk } from "../diff/types.js";

export function severityMeetsMinimum(severity: ReviewSeverity, minSeverity: ReviewSeverity): boolean {
  return severityRank(severity) <= severityRank(minSeverity);
}

export function filterIssuesByMinSeverity(issues: ReviewIssue[], filter?: SeverityFilter): ReviewIssue[] {
  if (!filter) return issues;
  return issues.filter((issue) => severityMeetsMinimum(issue.severity, filter.minSeverity));
}

export function deduplicateIssues(issues: ReviewIssue[]): ReviewIssue[] {
  const seen = new Map<string, ReviewIssue>();

  for (const issue of issues) {
    const key = `${issue.file}:${issue.line_start ?? 0}:${issue.title.toLowerCase().slice(0, 50)}`;
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

    const confidenceDiff = b.confidence - a.confidence;
    if (Math.abs(confidenceDiff) > 0.01) return confidenceDiff;

    return a.file.localeCompare(b.file);
  });
}

export function extractEvidenceFromDiff(file: FileDiff, lineStart: number | null, lineEnd: number | null): EvidenceRef[] {
  if (lineStart === null) return [];

  const matchingHunk = file.hunks.find((hunk: DiffHunk) => {
    const hunkEnd = hunk.newStart + hunk.newCount - 1;
    return lineStart >= hunk.newStart && lineStart <= hunkEnd;
  });

  if (!matchingHunk) return [];

  const lines = matchingHunk.content.split("\n");
  const relativeStart = lineStart - matchingHunk.newStart;
  const relativeEnd = lineEnd !== null ? lineEnd - matchingHunk.newStart : relativeStart;
  const excerpt = lines.slice(relativeStart, relativeEnd + 1).join("\n");

  return [
    {
      type: "code" as const,
      title: `Code at ${file.filePath}:${lineStart}`,
      sourceId: `${file.filePath}:${lineStart}-${lineEnd ?? lineStart}`,
      file: file.filePath,
      range: { start: lineStart, end: lineEnd ?? lineStart },
      excerpt: excerpt || lines.slice(0, 5).join("\n"),
    },
  ];
}

export function ensureIssueEvidence(issue: ReviewIssue, diff: ParsedDiff): ReviewIssue {
  if (issue.evidence && issue.evidence.length > 0) {
    return issue;
  }

  const file = diff.files.find((f: FileDiff) => f.filePath === issue.file);
  if (!file) {
    return {
      ...issue,
      evidence: [
        {
          type: "code" as const,
          title: `Issue in ${issue.file}`,
          sourceId: issue.file,
          file: issue.file,
          excerpt: issue.rationale,
        },
      ],
    };
  }

  const extractedEvidence = extractEvidenceFromDiff(file, issue.line_start, issue.line_end);
  return {
    ...issue,
    evidence:
      extractedEvidence.length > 0
        ? extractedEvidence
        : [
            {
              type: "code" as const,
              title: `Issue in ${issue.file}`,
              sourceId: issue.file,
              file: issue.file,
              excerpt: issue.rationale,
            },
          ],
  };
}

export function validateIssueCompleteness(issue: ReviewIssue): boolean {
  return Boolean(
    issue.id &&
      issue.severity &&
      issue.category &&
      issue.title &&
      issue.file &&
      issue.rationale &&
      issue.recommendation &&
      issue.symptom &&
      issue.whyItMatters &&
      issue.evidence &&
      issue.evidence.length > 0
  );
}
