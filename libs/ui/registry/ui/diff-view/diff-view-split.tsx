"use client";

import { useMemo, type KeyboardEvent, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { type ParsedDiff, type SplitCell, toSplitRows } from "@/lib/diff";
import { LINE_STYLE, SR_LABEL, LINE_NUMBER_CLASS, formatHunkHeader, LineContent } from "./diff-view-line.js";

function SplitCellView({ side, showLineNumbers, disableWordDiff }: {
  side: SplitCell;
  showLineNumbers: boolean;
  disableWordDiff: boolean;
}) {
  if (side.type === "empty") {
    return <div className="bg-muted/30 pl-2" aria-hidden="true">&nbsp;</div>;
  }

  return (
    <div className={cn("pl-2", LINE_STYLE[side.type])}>
      {showLineNumbers && (
        <span className={LINE_NUMBER_CLASS} aria-hidden="true">
          {side.lineNumber}
        </span>
      )}
      {SR_LABEL[side.type] && <span className="sr-only">{SR_LABEL[side.type]}</span>}
      <LineContent content={side.content} wordSegments={disableWordDiff ? undefined : side.wordSegments} type={side.type} />
    </div>
  );
}

export function SplitView({ parsed, showLineNumbers, disableWordDiff, activeHunk, onKeyDown, containerRef }: {
  parsed: ParsedDiff;
  showLineNumbers: boolean;
  disableWordDiff: boolean;
  activeHunk: string | null;
  onKeyDown: (e: KeyboardEvent) => void;
  containerRef: RefObject<HTMLElement | null>;
}) {
  const rows = useMemo(
    () => toSplitRows(parsed.hunks, !disableWordDiff),
    [disableWordDiff, parsed.hunks],
  );

  let hunkIndex = -1;

  return (
    <div
      ref={containerRef as RefObject<never>}
      aria-label="Split diff"
      aria-keyshortcuts="j k"
      className="overflow-x-auto focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <pre className="p-2">
        <code>
          {rows.map((row, i) => {
            if (row.kind === "separator") {
              hunkIndex++;
              return (
                <div
                  key={i}
                  data-hunk
                  data-diffgazer-navigation-item="button"
                  data-value={String(hunkIndex)}
                  className={cn(LINE_STYLE.hunk, activeHunk === String(hunkIndex) && "ring-1 ring-ring")}
                >
                  {formatHunkHeader(row)}
                </div>
              );
            }

            return (
              <div key={i} className="grid grid-cols-2 divide-x divide-border">
                <div role="group" aria-label="Old">
                  <SplitCellView side={row.left} showLineNumbers={showLineNumbers} disableWordDiff={disableWordDiff} />
                </div>
                <div role="group" aria-label="New">
                  <SplitCellView side={row.right} showLineNumbers={showLineNumbers} disableWordDiff={disableWordDiff} />
                </div>
              </div>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
