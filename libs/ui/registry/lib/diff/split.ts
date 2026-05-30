import type { DiffHunk, ChangeType } from "./parse";
import { computeWordSegments, createWordDiffBudget, type WordSegment } from "./word";
import { collectEditPairs } from "./pairs";

export interface SplitCell {
  type: ChangeType | "empty";
  content: string;
  lineNumber: number | null;
  wordSegments?: WordSegment[];
}

export type SplitRow =
  | { kind: "change"; left: SplitCell; right: SplitCell }
  | { kind: "separator"; oldStart: number; oldCount: number; newStart: number; newCount: number; heading: string };

export function toSplitRows(hunks: DiffHunk[], wordDiff: boolean): SplitRow[] {
  const rows: SplitRow[] = [];
  const wordDiffBudget = createWordDiffBudget();

  for (const hunk of hunks) {
    rows.push({
      kind: "separator",
      oldStart: hunk.oldStart,
      oldCount: hunk.oldCount,
      newStart: hunk.newStart,
      newCount: hunk.newCount,
      heading: hunk.heading,
    });

    for (const item of collectEditPairs(hunk.changes)) {
      if ("type" in item) {
        rows.push({
          kind: "change",
          left: { type: "context", content: item.content, lineNumber: item.oldLine },
          right: { type: "context", content: item.content, lineNumber: item.newLine },
        });
        continue;
      }

      const { removes, adds } = item;
      const pairs = Math.max(removes.length, adds.length);

      for (let j = 0; j < pairs; j++) {
        const remove = removes[j];
        const add = adds[j];
        let leftSegs: WordSegment[] | undefined;
        let rightSegs: WordSegment[] | undefined;

        if (wordDiff && remove && add) {
          const { old: oSegs, new: nSegs } = computeWordSegments(remove.content, add.content, wordDiffBudget);
          leftSegs = oSegs;
          rightSegs = nSegs;
        }

        rows.push({
          kind: "change",
          left: remove
            ? { type: "remove", content: remove.content, lineNumber: remove.oldLine, wordSegments: leftSegs }
            : { type: "empty", content: "", lineNumber: null },
          right: add
            ? { type: "add", content: add.content, lineNumber: add.newLine, wordSegments: rightSegs }
            : { type: "empty", content: "", lineNumber: null },
        });
      }
    }
  }

  return rows;
}
