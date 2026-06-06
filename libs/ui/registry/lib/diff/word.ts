import { buildLcsTable } from "./lcs";
import { collectEditPairs } from "./pairs";
import type { DiffChange } from "./parse";

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
    const oldWord = oldWords[i - 1] ?? "";
    const newWord = newWords[j - 1] ?? "";
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      oldSegs.push({ text: oldWord, changed: false });
      newSegs.push({ text: newWord, changed: false });
      i--; j--;
      continue;
    }
    const upRow = dp[i - 1] ?? [];
    const curRow = dp[i] ?? [];
    const left = curRow[j - 1] ?? 0;
    const up = upRow[j] ?? 0;
    if (j > 0 && (i === 0 || left >= up)) {
      newSegs.push({ text: newWord, changed: true });
      j--;
    } else {
      oldSegs.push({ text: oldWord, changed: true });
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

    const segmentPairs: { old: WordSegment[]; new: WordSegment[] }[] = [];
    for (let j = 0; j < pairs; j++) {
      const remove = removes[j];
      const add = adds[j];
      if (!remove || !add) continue;
      segmentPairs.push(computeWordSegments(remove.content, add.content, budget));
    }

    for (let j = 0; j < pairs; j++) {
      const remove = removes[j];
      const seg = segmentPairs[j];
      if (!remove || !seg) continue;
      result.push({ ...remove, wordSegments: seg.old });
    }
    for (let j = pairs; j < removes.length; j++) {
      const remove = removes[j];
      if (remove) result.push(remove);
    }

    for (let j = 0; j < pairs; j++) {
      const add = adds[j];
      const seg = segmentPairs[j];
      if (!add || !seg) continue;
      result.push({ ...add, wordSegments: seg.new });
    }
    for (let j = pairs; j < adds.length; j++) {
      const add = adds[j];
      if (add) result.push(add);
    }
  }

  return result;
}
