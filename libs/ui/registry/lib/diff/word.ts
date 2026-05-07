import type { DiffChange } from "./parse.js";
import { buildLcsTable } from "./lcs.js";
import { collectEditPairs } from "./pairs.js";

export interface WordSegment {
  text: string;
  changed: boolean;
}

export interface AnnotatedChange extends DiffChange {
  wordSegments?: WordSegment[];
}

export interface WordDiffBudget {
  remainingCells: number;
}

export const DEFAULT_WORD_DIFF_CELL_BUDGET = 50_000;

export function createWordDiffBudget(maxCells = DEFAULT_WORD_DIFF_CELL_BUDGET): WordDiffBudget {
  return { remainingCells: maxCells };
}

function changedLineSegments(oldContent: string, newContent: string): { old: WordSegment[]; new: WordSegment[] } {
  return {
    old: [{ text: oldContent, changed: true }],
    new: [{ text: newContent, changed: true }],
  };
}

export function computeWordSegments(
  oldContent: string,
  newContent: string,
  budget?: WordDiffBudget,
): { old: WordSegment[]; new: WordSegment[] } {
  const oldWords = oldContent.split(/(\s+)/);
  const newWords = newContent.split(/(\s+)/);
  const cellCost = oldWords.length * newWords.length;

  if (budget) {
    if (cellCost > budget.remainingCells) {
      return changedLineSegments(oldContent, newContent);
    }
    budget.remainingCells -= cellCost;
  }

  const dp = buildLcsTable(oldWords, newWords);

  if (!dp) {
    return changedLineSegments(oldContent, newContent);
  }

  const m = oldWords.length;
  const n = newWords.length;

  const oldSegs: WordSegment[] = [];
  const newSegs: WordSegment[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      oldSegs.push({ text: oldWords[i - 1], changed: false });
      newSegs.push({ text: newWords[j - 1], changed: false });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      newSegs.push({ text: newWords[j - 1], changed: true });
      j--;
    } else {
      oldSegs.push({ text: oldWords[i - 1], changed: true });
      i--;
    }
  }

  oldSegs.reverse();
  newSegs.reverse();

  return { old: mergeSegments(oldSegs), new: mergeSegments(newSegs) };
}

function mergeSegments(segments: WordSegment[]): WordSegment[] {
  const result: WordSegment[] = [];
  for (const seg of segments) {
    const last = result[result.length - 1];
    if (last && last.changed === seg.changed) {
      last.text += seg.text;
    } else {
      result.push({ text: seg.text, changed: seg.changed });
    }
  }
  return result;
}

export function annotateWordDiff(
  changes: DiffChange[],
  budget = createWordDiffBudget(),
): AnnotatedChange[] {
  const result: AnnotatedChange[] = [];

  for (const item of collectEditPairs(changes)) {
    if ("type" in item) {
      result.push(item);
      continue;
    }

    const { removes, adds } = item;
    const pairs = Math.min(removes.length, adds.length);

    const segmentPairs = [];
    for (let j = 0; j < pairs; j++) {
      segmentPairs.push(computeWordSegments(removes[j].content, adds[j].content, budget));
    }

    for (let j = 0; j < pairs; j++) {
      result.push({ ...removes[j], wordSegments: segmentPairs[j].old });
    }
    for (let j = pairs; j < removes.length; j++) result.push(removes[j]);

    for (let j = 0; j < pairs; j++) {
      result.push({ ...adds[j], wordSegments: segmentPairs[j].new });
    }
    for (let j = pairs; j < adds.length; j++) result.push(adds[j]);
  }

  return result;
}
