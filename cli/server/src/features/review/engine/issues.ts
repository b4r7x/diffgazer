import { severityRank } from "@diffgazer/core/schemas/presentation";
import type {
  EvidenceRef,
  ReviewIssue,
  ReviewSeverity,
  SeverityFilter,
} from "@diffgazer/core/schemas/review";
import type { DiffHunk, FileDiff, ParsedDiff } from "./diff/types.js";

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

/**
 * Normalizes provider-supplied line numbers that the lenient issue schema no
 * longer rejects: floors non-integers, nulls non-positive values, swaps inverted
 * ranges, and nulls a `line_end` left without a `line_start`. Applied on the
 * write path so persisted issues carry sane line fields without a fatal refine.
 */
export function normalizeIssueLineFields(issue: ReviewIssue): ReviewIssue {
  const normalizeOne = (value: number | null): number | null => {
    if (value === null) return null;
    const floored = Math.floor(value);
    return floored > 0 ? floored : null;
  };

  let lineStart = normalizeOne(issue.line_start);
  let lineEnd = normalizeOne(issue.line_end);

  if (lineEnd !== null && lineStart === null) {
    lineEnd = null;
  }
  if (lineStart !== null && lineEnd !== null && lineEnd < lineStart) {
    [lineStart, lineEnd] = [lineEnd, lineStart];
  }

  if (lineStart === issue.line_start && lineEnd === issue.line_end) {
    return issue;
  }
  return { ...issue, line_start: lineStart, line_end: lineEnd };
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

function stripDiffPrefix(line: string): string {
  if (line.length > 0 && (line[0] === "+" || line[0] === " ")) {
    return line.slice(1);
  }
  return line;
}

function extractEvidenceFromDiff(
  file: FileDiff,
  lineStart: number | null,
  lineEnd: number | null,
): EvidenceRef[] {
  if (lineStart === null) return [];

  const matchingHunk = file.hunks.find((hunk: DiffHunk) => {
    const hunkEnd = hunk.newStart + hunk.newCount - 1;
    return lineStart >= hunk.newStart && lineStart <= hunkEnd;
  });

  if (!matchingHunk) return [];

  const effectiveEnd = lineEnd ?? lineStart;
  const rawLines = matchingHunk.content.split("\n");
  const excerptLines: string[] = [];
  let newLine = matchingHunk.newStart;

  for (const raw of rawLines) {
    if (raw.startsWith("@@") || raw.startsWith("-") || raw.startsWith("\\ ")) {
      continue;
    }
    if (newLine >= lineStart && newLine <= effectiveEnd) {
      excerptLines.push(stripDiffPrefix(raw));
    }
    newLine++;
    if (newLine > effectiveEnd) break;
  }

  const excerpt = excerptLines.join("\n");

  const fallbackLines: string[] = [];
  if (!excerpt) {
    let count = 0;
    for (const raw of rawLines) {
      if (raw.startsWith("@@") || raw.startsWith("-") || raw.startsWith("\\ ")) continue;
      fallbackLines.push(stripDiffPrefix(raw));
      if (++count >= 5) break;
    }
  }

  return [
    {
      type: "code" as const,
      title: `Code at ${file.filePath}:${lineStart}`,
      sourceId: `${file.filePath}:${lineStart}-${effectiveEnd}`,
      file: file.filePath,
      range: { start: lineStart, end: effectiveEnd },
      excerpt: excerpt || fallbackLines.join("\n"),
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
      issue.evidence.length > 0,
  );
}
