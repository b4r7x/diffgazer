import {
  EVIDENCE_GAP_MARKER,
  type EvidenceRef,
  type ReviewIssue,
} from "@diffgazer/core/schemas/review";
import type { DiffHunk, ParsedDiff } from "../diff/types.js";
import { isCompleteEvidenceReference, normalizeIssueLineFields } from "./normalization.js";

/**
 * Rows one synthesized excerpt may print, marker rows included. Five showed only
 * the head of a long citation — the imports above the subject, never the subject.
 * The JSON byte cap below is the real payload bound; this only keeps a pane
 * readable.
 */
export const MAX_SYNTHESIZED_EVIDENCE_LINES = 32;
/** Maximum UTF-8 bytes occupied by `JSON.stringify(excerpt)`. */
export const MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES = 4 * 1024;
const SYNTHESIZED_EVIDENCE_TRUNCATION_MARKER = " ... [evidence truncated]";
const JSON_STRING_DELIMITER_BYTES = 2;
const BLANK_ROW_PATTERN = /^[ \t\r]*$/;

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

function boundSynthesizedLines(lines: string[], forceMarker = false): string[] {
  if (lines.length === 0) return [];

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

  return boundedLines;
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

/** A contiguous run of reviewed source, starting at the file line it occupies. */
interface EvidenceSegment {
  start: number;
  lines: string[];
}

/** One rendered excerpt row: the source line it prints, or null for a gap marker. */
interface ExcerptRow {
  text: string;
  line: number | null;
}

function gapRow(): ExcerptRow {
  return { text: EVIDENCE_GAP_MARKER, line: null };
}

function isDroppableEdgeRow(row: ExcerptRow | undefined): boolean {
  if (row === undefined) return false;
  return row.line === null || BLANK_ROW_PATTERN.test(row.text);
}

/**
 * Drops leading, trailing, and doubled gap markers so a marker always stands
 * between real code, and drops blank rows off both edges. The blank-row rule
 * mirrors the excerpt schema's own trim: the row count the numbers were built
 * from must equal the row count the stored excerpt parses back to, or a citation
 * opening on a blank line shifts every gutter number by one.
 */
function normalizeExcerptRows(rows: ExcerptRow[]): ExcerptRow[] {
  const normalized: ExcerptRow[] = [];

  for (const row of rows) {
    if (normalized.length === 0 && isDroppableEdgeRow(row)) continue;
    if (row.line === null && normalized.at(-1)?.line === null) continue;
    normalized.push(row);
  }
  while (isDroppableEdgeRow(normalized.at(-1))) normalized.pop();

  return normalized;
}

/** Rows the segments occupy in order, gap markers between them included. */
function totalRowCount(segments: EvidenceSegment[]): number {
  return segments.reduce((total, segment) => total + segment.lines.length, 0) + segments.length - 1;
}

/** Materializes only rows `[from, to)` of that sequence, so a huge citation is never expanded whole. */
function collectRows(segments: EvidenceSegment[], from: number, to: number): ExcerptRow[] {
  const rows: ExcerptRow[] = [];
  let index = 0;

  for (const [segmentIndex, segment] of segments.entries()) {
    if (segmentIndex > 0) {
      if (index >= from && index < to) rows.push(gapRow());
      index++;
    }
    for (const [lineIndex, text] of segment.lines.entries()) {
      if (index >= from && index < to) rows.push({ text, line: segment.start + lineIndex });
      index++;
      if (index >= to) return rows;
    }
  }

  return rows;
}

/**
 * Windows the cited source to the row cap. Over the cap the excerpt keeps its
 * head and its tail around one gap marker: a head-only slice hides the subject
 * of a long citation behind whatever boilerplate opens it.
 */
function buildExcerptRows(segments: EvidenceSegment[]): ExcerptRow[] {
  const nonemptySegments = segments.filter((segment) => segment.lines.length > 0);
  if (nonemptySegments.length === 0) return [];

  const total = totalRowCount(nonemptySegments);
  if (total <= MAX_SYNTHESIZED_EVIDENCE_LINES) {
    return normalizeExcerptRows(collectRows(nonemptySegments, 0, total));
  }

  const headCount = Math.ceil((MAX_SYNTHESIZED_EVIDENCE_LINES - 1) / 2);
  const tailCount = MAX_SYNTHESIZED_EVIDENCE_LINES - 1 - headCount;
  return normalizeExcerptRows([
    ...collectRows(nonemptySegments, 0, headCount),
    gapRow(),
    ...collectRows(nonemptySegments, total - tailCount, total),
  ]);
}

/**
 * Applies the JSON byte cap to rendered rows. The cap can cut a row down to its
 * own indentation, and the excerpt schema drops blank rows off both edges when
 * the excerpt is read back, so the bounded rows are normalized again here: the
 * gutter numbers must describe the excerpt as it parses back, not the rows it
 * was rendered from.
 */
function boundExcerptRows(rows: ExcerptRow[]): ExcerptRow[] {
  const boundedTexts = boundSynthesizedLines(rows.map((row) => row.text));
  return normalizeExcerptRows(
    rows.map((row, index) => ({ text: boundedTexts[index] ?? "", line: row.line })),
  );
}

function excerptFromLines(lines: string[]): string {
  const included = lines.slice(0, MAX_SYNTHESIZED_EVIDENCE_LINES);
  return boundSynthesizedLines(included, lines.length > MAX_SYNTHESIZED_EVIDENCE_LINES).join("\n");
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
    return [
      {
        start: segmentStart,
        lines: hunk.lines.slice(startOffset, startOffset + segmentEnd - segmentStart + 1),
      },
    ];
  });
  const rows = boundExcerptRows(buildExcerptRows(segments));
  const excerpt = rows.map((row) => row.text).join("\n");

  if (!excerpt) return [];

  // The reported range is what the excerpt actually shows, not what the model
  // cited: a citation reaching outside the diff resolves to the lines the hunks
  // hold, and titling it with the requested start would point at code no reader
  // is looking at. The cited range stays on the issue's own line fields.
  const includedLines = rows.flatMap((row) => (row.line === null ? [] : [row.line]));
  const includedStart = includedLines[0] ?? rangeStart;
  const includedEnd = includedLines.at(-1) ?? rangeEnd;

  return [
    {
      type: "code" as const,
      title: `Code at ${file.filePath}:${includedStart}`,
      sourceId: `${file.filePath}:${includedStart}-${includedEnd}`,
      file: file.filePath,
      range: { start: includedStart, end: includedEnd },
      excerpt,
      excerptLineNumbers: rows.map((row) => row.line),
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
      // Prose, not source: it has no line numbers to print and reads from the
      // top, so it keeps its head rather than being sampled around a gap.
      excerpt: excerptFromLines(issue.rationale.split("\n")),
    },
  ];
}

/**
 * Resolves one issue's evidence. Code evidence is always re-derived from the
 * diff under review and ordered first: an excerpt the results view renders as
 * code must be the reviewed source, never provider-authored text dressed as it.
 * Complete provider references of every other type are retained after it.
 */
export function createIssueEvidenceResolver(diff: ParsedDiff): (issue: ReviewIssue) => ReviewIssue {
  let files: Map<string, IndexedFileDiff> | undefined;

  return (issue) => {
    const normalizedIssue = normalizeIssueLineFields(issue);
    const retainedReferences = normalizedIssue.evidence.filter(
      (reference) => reference.type !== "code" && isCompleteEvidenceReference(reference),
    );
    files ??= indexDiffFiles(diff);
    const file = files.get(normalizedIssue.file);
    const extractedEvidence = file
      ? extractEvidenceFromDiff(file, normalizedIssue.line_start, normalizedIssue.line_end)
      : [];
    const codeEvidence =
      extractedEvidence.length > 0 ? extractedEvidence : fallbackIssueEvidence(normalizedIssue);
    return {
      ...normalizedIssue,
      evidence: [...codeEvidence, ...retainedReferences],
    };
  };
}
