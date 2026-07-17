import { buildLcsTable } from "./lcs";
import type { DiffChange, DiffHunk, ParsedDiff } from "./parse";

const CONTEXT = 3;
export const NO_NEWLINE_MARKER = "\\ No newline at end of file";

/** Computes a single-file parsed diff from before/after text. */
export function computeDiff(before: string, after: string): ParsedDiff {
  if (before === after) return { oldPath: null, newPath: null, hunks: [] };

  const oldLines = splitDiffLines(before);
  const newLines = splitDiffLines(after);
  const edits = lcsEdits(oldLines, newLines);
  const beforeHasNoNewline = before !== "" && !before.endsWith("\n");
  const afterHasNoNewline = after !== "" && !after.endsWith("\n");
  if (beforeHasNoNewline !== afterHasNoNewline) {
    edits.push({
      type: afterHasNoNewline ? "add" : "remove",
      content: NO_NEWLINE_MARKER,
      oldLine: null,
      newLine: null,
    });
  }
  return { oldPath: null, newPath: null, hunks: groupHunks(edits) };
}

function splitDiffLines(value: string): string[] {
  if (value === "") return [];
  const lines = value.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function naiveEdits(oldLines: string[], newLines: string[]): DiffChange[] {
  const edits: DiffChange[] = [];
  for (let i = 0; i < oldLines.length; i++) {
    const content = oldLines[i] ?? "";
    edits.push({ type: "remove", content, oldLine: i + 1, newLine: null });
  }
  for (let j = 0; j < newLines.length; j++) {
    const content = newLines[j] ?? "";
    edits.push({ type: "add", content, oldLine: null, newLine: j + 1 });
  }
  return edits;
}

function lcsEdits(oldLines: string[], newLines: string[]): DiffChange[] {
  const dp = buildLcsTable(oldLines, newLines);
  if (!dp) return naiveEdits(oldLines, newLines);

  const m = oldLines.length;
  const n = newLines.length;

  const edits: DiffChange[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    const oldContent = oldLines[i - 1] ?? "";
    const newContent = newLines[j - 1] ?? "";
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      edits.push({ type: "context", content: oldContent, oldLine: i, newLine: j });
      i--;
      j--;
      continue;
    }
    const upRow = dp[i - 1] ?? [];
    const curRow = dp[i] ?? [];
    const left = curRow[j - 1] ?? 0;
    const up = upRow[j] ?? 0;
    if (j > 0 && (i === 0 || left >= up)) {
      edits.push({ type: "add", content: newContent, oldLine: null, newLine: j });
      j--;
    } else {
      edits.push({ type: "remove", content: oldContent, oldLine: i, newLine: null });
      i--;
    }
  }
  edits.reverse();
  return edits;
}

function findChangeIndices(edits: DiffChange[]): number[] {
  const indices: number[] = [];
  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    if (edit && edit.type !== "context") indices.push(i);
  }
  return indices;
}

function mergeNearbyRanges(indices: number[], gap: number): [number, number][] {
  const ranges: [number, number][] = [];
  const first = indices[0];
  if (first === undefined) return ranges;
  let start = first;
  let end = first;
  for (let k = 1; k < indices.length; k++) {
    const idx = indices[k];
    if (idx === undefined) continue;
    if (idx - end <= gap) {
      end = idx;
    } else {
      ranges.push([start, end]);
      start = idx;
      end = idx;
    }
  }
  ranges.push([start, end]);
  return ranges;
}

function buildHunk(edits: DiffChange[], range: [number, number], context: number): DiffHunk {
  const from = Math.max(0, range[0] - context);
  const to = Math.min(edits.length - 1, range[1] + context);
  const changes = edits.slice(from, to + 1);

  const firstOld = changes.find((e) => e.oldLine != null);
  const firstNew = changes.find((e) => e.newLine != null);

  let oldCount = 0;
  let newCount = 0;
  for (const e of changes) {
    if (e.oldLine !== null) oldCount++;
    if (e.newLine !== null) newCount++;
  }

  return {
    oldStart: firstOld?.oldLine ?? 0,
    oldCount,
    newStart: firstNew?.newLine ?? 0,
    newCount,
    heading: "",
    changes,
  };
}

function groupHunks(edits: DiffChange[]): DiffHunk[] {
  const indices = findChangeIndices(edits);
  if (indices.length === 0) return [];
  const ranges = mergeNearbyRanges(indices, CONTEXT * 2 + 1);
  return ranges.map((range) => buildHunk(edits, range, CONTEXT));
}
