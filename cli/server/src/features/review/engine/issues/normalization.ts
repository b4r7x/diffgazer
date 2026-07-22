import type { EvidenceRef, ReviewIssue } from "@diffgazer/core/schemas/review";
import { isValidEvidenceRange } from "@diffgazer/core/schemas/review";

function hasVisibleText(value: string): boolean {
  return value.trim().length > 0;
}

export function isCompleteEvidenceReference(reference: EvidenceRef): boolean {
  return (
    hasVisibleText(reference.title) &&
    hasVisibleText(reference.sourceId) &&
    hasVisibleText(reference.excerpt)
  );
}

/**
 * Normalizes provider-supplied line numbers that the lenient issue schema no
 * longer rejects: floors non-integers, nulls non-positive values, swaps inverted
 * ranges, and nulls a `line_end` left without a `line_start`. Applied on the
 * write path so persisted issues carry sane locations without a fatal refine.
 * Invalid evidence ranges are removed while the evidence excerpt is retained.
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

  let evidenceChanged = false;
  const evidence = issue.evidence.map((item) => {
    if (item.range === undefined || isValidEvidenceRange(item.range)) return item;
    evidenceChanged = true;
    const { range: _range, ...withoutRange } = item;
    return withoutRange;
  });

  if (lineStart === issue.line_start && lineEnd === issue.line_end && !evidenceChanged) {
    return issue;
  }
  return { ...issue, line_start: lineStart, line_end: lineEnd, evidence };
}

export function normalizeIssueTextFields(issue: ReviewIssue): ReviewIssue {
  return {
    ...issue,
    id: issue.id.trim(),
    title: issue.title.trim(),
    file: issue.file.trim(),
    rationale: issue.rationale.trim(),
    recommendation: issue.recommendation.trim(),
    symptom: issue.symptom.trim(),
    whyItMatters: issue.whyItMatters.trim(),
    evidence: issue.evidence.map((reference) => ({
      ...reference,
      title: reference.title.trim(),
      sourceId: reference.sourceId.trim(),
      excerpt: reference.excerpt.trim(),
      ...(reference.file === undefined ? {} : { file: reference.file.trim() }),
      ...(reference.sha === undefined ? {} : { sha: reference.sha.trim() }),
    })),
  };
}

export function validateIssueCompleteness(issue: ReviewIssue): boolean {
  return (
    hasVisibleText(issue.id) &&
    hasVisibleText(issue.title) &&
    hasVisibleText(issue.file) &&
    hasVisibleText(issue.rationale) &&
    hasVisibleText(issue.recommendation) &&
    hasVisibleText(issue.symptom) &&
    hasVisibleText(issue.whyItMatters) &&
    issue.evidence.some(isCompleteEvidenceReference)
  );
}
