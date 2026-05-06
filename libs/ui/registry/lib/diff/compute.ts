import type { DiffChange, DiffHunk, ParsedDiff } from "./parse.js";
import { buildLcsTable } from "./lcs.js";

const CONTEXT = 3;

export function computeDiff(before: string, after: string): ParsedDiff {
  const oldLines = splitDiffLines(before);
  const newLines = splitDiffLines(after);
  const edits = lcsEdits(oldLines, newLines);
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
    edits.push({ type: "remove", content: oldLines[i], oldLine: i + 1, newLine: null });
  }
  for (let j = 0; j < newLines.length; j++) {
    edits.push({ type: "add", content: newLines[j], oldLine: null, newLine: j + 1 });
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
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      edits.push({ type: "context", content: oldLines[i - 1], oldLine: i, newLine: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      edits.push({ type: "add", content: newLines[j - 1], oldLine: null, newLine: j });
      j--;
    } else {
      edits.push({ type: "remove", content: oldLines[i - 1], oldLine: i, newLine: null });
      i--;
    }
  }
  edits.reverse();
  return edits;
}

function findChangeIndices(edits: DiffChange[]): number[] {
  const indices: number[] = [];
  for (let i = 0; i < edits.length; i++) {
    if (edits[i].type !== "context") indices.push(i);
  }
  return indices;
}

function mergeNearbyRanges(indices: number[], gap: number): [number, number][] {
  const ranges: [number, number][] = [];
  let start = indices[0];
  let end = indices[0];
  for (let k = 1; k < indices.length; k++) {
    if (indices[k] - end <= gap) {
      end = indices[k];
    } else {
      ranges.push([start, end]);
      start = indices[k];
      end = indices[k];
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
    if (e.type !== "add") oldCount++;
    if (e.type !== "remove") newCount++;
  }

  return {
    oldStart: firstOld?.oldLine ?? 1,
    oldCount,
    newStart: firstNew?.newLine ?? 1,
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
