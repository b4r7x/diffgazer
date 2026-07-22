import type { EvidenceRef, ReviewIssue } from "@diffgazer/core/schemas/review";
import { MAX_REVIEW_ISSUES } from "@diffgazer/core/schemas/review";
import type { DiffHunk, ParsedDiff } from "../diff/types.js";
import { isCompleteEvidenceReference, normalizeIssueLineFields } from "./normalization.js";

export const MAX_SYNTHESIZED_EVIDENCE_LINES = 5;
/** Maximum UTF-8 bytes occupied by `JSON.stringify(excerpt)`. */
export const MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES = 4 * 1024;
/** Maximum synthesized-excerpt contribution across the closed-lens final result. */
export const MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES_PER_REVIEW =
  MAX_REVIEW_ISSUES * MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES;

const SYNTHESIZED_EVIDENCE_TRUNCATION_MARKER = " ... [evidence truncated]";
const SYNTHESIZED_EVIDENCE_GAP_MARKER = "... [evidence gap] ...";
const JSON_STRING_DELIMITER_BYTES = 2;

function stripDiffPrefix(line: string): string {
  if (line.length > 0 && (line[0] === "+" || line[0] === " ")) {
    return line.slice(1);
  }
  return line;
}

function jsonCharacterBytes(character: string): number {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) return 0;

  if (codePoint === 0x22 || codePoint === 0x5c) return 2;
  if (
    codePoint === 0x08 ||
    codePoint === 0x09 ||
    codePoint === 0x0a ||
    codePoint === 0x0c ||
    codePoint === 0x0d
  ) {
    return 2;
  }
  if (codePoint <= 0x1f || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return 6;
  if (codePoint <= 0x7f) return 1;
  if (codePoint <= 0x7ff) return 2;
  if (codePoint <= 0xffff) return 3;
  return 4;
}

function jsonContentBytes(value: string): number {
  let bytes = 0;
  for (const character of value) bytes += jsonCharacterBytes(character);
  return bytes;
}

function prefixWithinJsonBudget(value: string, budget: number): number {
  let bytes = 0;
  let end = 0;

  for (const character of value) {
    const nextBytes = jsonCharacterBytes(character);
    if (bytes + nextBytes > budget) return end;
    bytes += nextBytes;
    end += character.length;
  }

  return end;
}

function boundSynthesizedLines(lines: string[], forceMarker = false): string {
  if (lines.length === 0) return "";

  const contentBudget = MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES - JSON_STRING_DELIMITER_BYTES;
  const separatorBytes = jsonContentBytes("\n") * (lines.length - 1);
  const unboundedContentBytes = lines.reduce(
    (total, line) => total + jsonContentBytes(line),
    separatorBytes,
  );
  const needsMarker = forceMarker || unboundedContentBytes > contentBudget;
  let remainingBudget =
    contentBudget -
    separatorBytes -
    (needsMarker ? jsonContentBytes(SYNTHESIZED_EVIDENCE_TRUNCATION_MARKER) : 0);
  const boundedLines: string[] = [];

  for (const [index, line] of lines.entries()) {
    const remainingLineCount = lines.length - index;
    const lineBudget = Math.max(0, Math.floor(remainingBudget / remainingLineCount));
    const prefixEnd = prefixWithinJsonBudget(line, lineBudget);
    const boundedLine = line.slice(0, prefixEnd);
    boundedLines.push(boundedLine);
    remainingBudget -= jsonContentBytes(boundedLine);
  }

  if (needsMarker) {
    const lastIndex = boundedLines.length - 1;
    boundedLines[lastIndex] =
      `${boundedLines[lastIndex] ?? ""}${SYNTHESIZED_EVIDENCE_TRUNCATION_MARKER}`;
  }

  return boundedLines.join("\n");
}

interface IndexedHunk {
  newStart: number;
  newEnd: number;
  lines: string[];
}

interface IndexedFileDiff {
  filePath: string;
  hunks: IndexedHunk[];
}

function indexHunk(hunk: DiffHunk): IndexedHunk {
  const lines: string[] = [];

  for (const raw of hunk.content.split("\n")) {
    if (raw.startsWith("@@") || raw.startsWith("-") || raw.startsWith("\\ ")) continue;
    lines.push(stripDiffPrefix(raw));
  }

  return {
    newStart: hunk.newStart,
    newEnd: hunk.newStart + hunk.newCount - 1,
    lines,
  };
}

function indexDiffFiles(diff: ParsedDiff): Map<string, IndexedFileDiff> {
  const files = new Map<string, IndexedFileDiff>();

  for (const file of diff.files) {
    if (files.has(file.filePath)) continue;
    files.set(file.filePath, {
      filePath: file.filePath,
      hunks: file.hunks.map(indexHunk),
    });
  }

  return files;
}

function excerptFromLines(lines: string[]): string {
  const included = lines.slice(0, MAX_SYNTHESIZED_EVIDENCE_LINES);
  return boundSynthesizedLines(included, lines.length > MAX_SYNTHESIZED_EVIDENCE_LINES);
}

function excerptFromSegments(segments: string[][]): string {
  const nonemptySegments = segments.filter((segment) => segment.length > 0);
  if (nonemptySegments.length === 0) return "";
  if (nonemptySegments.length === 1) return excerptFromLines(nonemptySegments[0] ?? []);

  const representedSegments =
    nonemptySegments.length <= 3
      ? nonemptySegments
      : [nonemptySegments[0] ?? [], nonemptySegments.at(-1) ?? []];
  const lineCounts = representedSegments.map(() => 1);
  let remainingLines =
    MAX_SYNTHESIZED_EVIDENCE_LINES - (representedSegments.length - 1) - lineCounts.length;

  while (remainingLines > 0) {
    let allocated = false;
    for (const [index, segment] of representedSegments.entries()) {
      if (remainingLines === 0) break;
      const count = lineCounts[index] ?? 0;
      if (count >= segment.length) continue;
      lineCounts[index] = count + 1;
      remainingLines--;
      allocated = true;
    }
    if (!allocated) break;
  }

  const excerptLines: string[] = [];
  let includedSourceLines = 0;
  for (const [index, segment] of representedSegments.entries()) {
    if (index > 0) excerptLines.push(SYNTHESIZED_EVIDENCE_GAP_MARKER);
    const included = segment.slice(0, lineCounts[index]);
    excerptLines.push(...included);
    includedSourceLines += included.length;
  }

  const totalSourceLines = nonemptySegments.reduce((total, segment) => total + segment.length, 0);
  return boundSynthesizedLines(
    excerptLines,
    representedSegments.length < nonemptySegments.length || includedSourceLines < totalSourceLines,
  );
}

function extractEvidenceFromDiff(
  file: IndexedFileDiff,
  lineStart: number | null,
  lineEnd: number | null,
): EvidenceRef[] {
  if (lineStart === null) return [];

  const requestedEnd = lineEnd ?? lineStart;
  const rangeStart = Math.min(lineStart, requestedEnd);
  const rangeEnd = Math.max(lineStart, requestedEnd);
  const segments = file.hunks.flatMap((hunk) => {
    const segmentStart = Math.max(rangeStart, hunk.newStart);
    const segmentEnd = Math.min(rangeEnd, hunk.newEnd);
    if (segmentStart > segmentEnd) return [];
    const startOffset = segmentStart - hunk.newStart;
    return [hunk.lines.slice(startOffset, startOffset + segmentEnd - segmentStart + 1)];
  });
  const excerpt = excerptFromSegments(segments);

  if (!excerpt) return [];

  return [
    {
      type: "code" as const,
      title: `Code at ${file.filePath}:${rangeStart}`,
      sourceId: `${file.filePath}:${rangeStart}-${rangeEnd}`,
      file: file.filePath,
      range: { start: rangeStart, end: rangeEnd },
      excerpt,
    },
  ];
}

function fallbackIssueEvidence(issue: ReviewIssue): EvidenceRef[] {
  return [
    {
      type: "code" as const,
      title: `Issue in ${issue.file}`,
      sourceId: issue.file,
      file: issue.file,
      excerpt: excerptFromLines(issue.rationale.split("\n")),
    },
  ];
}

export function createIssueEvidenceResolver(diff: ParsedDiff): (issue: ReviewIssue) => ReviewIssue {
  let files: Map<string, IndexedFileDiff> | undefined;

  return (issue) => {
    const completeEvidence = issue.evidence.filter(isCompleteEvidenceReference);
    if (completeEvidence.length > 0) {
      return completeEvidence.length === issue.evidence.length
        ? issue
        : { ...issue, evidence: completeEvidence };
    }

    const normalizedIssue = normalizeIssueLineFields(issue);
    files ??= indexDiffFiles(diff);
    const file = files.get(normalizedIssue.file);
    const extractedEvidence = file
      ? extractEvidenceFromDiff(file, normalizedIssue.line_start, normalizedIssue.line_end)
      : [];
    return {
      ...normalizedIssue,
      evidence:
        extractedEvidence.length > 0 ? extractedEvidence : fallbackIssueEvidence(normalizedIssue),
    };
  };
}

export function ensureIssueEvidence(issue: ReviewIssue, diff: ParsedDiff): ReviewIssue {
  return createIssueEvidenceResolver(diff)(issue);
}
