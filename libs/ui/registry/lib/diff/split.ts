import type { DiffHunk, ChangeType } from "./parse.js";
import { computeWordSegments, type WordSegment } from "./word.js";
import { collectEditPairs } from "./pairs.js";

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
        let leftSegs: WordSegment[] | undefined;
        let rightSegs: WordSegment[] | undefined;

        if (wordDiff && j < removes.length && j < adds.length) {
          const { old: oSegs, new: nSegs } = computeWordSegments(removes[j].content, adds[j].content);
          leftSegs = oSegs;
          rightSegs = nSegs;
        }

        rows.push({
          kind: "change",
          left: j < removes.length
            ? { type: "remove", content: removes[j].content, lineNumber: removes[j].oldLine, wordSegments: leftSegs }
            : { type: "empty", content: "", lineNumber: null },
          right: j < adds.length
            ? { type: "add", content: adds[j].content, lineNumber: adds[j].newLine, wordSegments: rightSegs }
            : { type: "empty", content: "", lineNumber: null },
        });
      }
    }
  }

  return rows;
}
