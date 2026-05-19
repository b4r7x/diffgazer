"use client";

import { useMemo, type KeyboardEvent, type RefObject } from "react";
import { type ParsedDiff, type SplitCell, type SplitRow, toSplitRows } from "@/lib/diff";
import {
  LINE_PREFIX,
  ROW_STATE,
  SR_LABEL,
  formatHunkHeader,
  LineContent,
} from "./diff-view-line.js";

export function SplitView({
  parsed,
  showLineNumbers,
  disableWordDiff,
  isDense,
  activeHunk,
  onKeyDown,
  containerRef,
}: {
  parsed: ParsedDiff;
  showLineNumbers: boolean;
  disableWordDiff: boolean;
  isDense: boolean;
  activeHunk: string | null;
  onKeyDown: (e: KeyboardEvent) => void;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const rows: SplitRow[] = useMemo(
    () => toSplitRows(parsed.hunks, !disableWordDiff),
    [disableWordDiff, parsed.hunks],
  );

  const { leftRows, rightRows } = useMemo(
    () => partitionSplitRows(rows),
    [rows],
  );

  return (
    // containerRef on the outer split (not on each SplitSide rows): useNavigation
    // queries by data-diffgazer-navigation-item, which only the left side registers,
    // so one shared ref covers both panes without double-counting hunks.
    <div
      ref={containerRef}
      data-slot="diff-view-split"
      aria-label="Split diff"
      aria-keyshortcuts="j k Escape"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <SplitSide
        side="old"
        rows={leftRows}
        showLineNumbers={showLineNumbers}
        disableWordDiff={disableWordDiff}
        isDense={isDense}
        activeHunk={activeHunk}
        registerNavigationItems
      />
      <SplitSide
        side="new"
        rows={rightRows}
        showLineNumbers={showLineNumbers}
        disableWordDiff={disableWordDiff}
        isDense={isDense}
        activeHunk={activeHunk}
        registerNavigationItems={false}
      />
    </div>
  );
}

/**
 * A side is a sequence of separators interleaved with cells. Both panes
 * render the same separators (full @@ header text in the code cell) at the
 * same positions; only the cell content differs.
 */
type SideEntry =
  | { kind: "separator"; hunkIndex: number; row: Extract<SplitRow, { kind: "separator" }> }
  | { kind: "cell"; cell: SplitCell };

function partitionSplitRows(rows: SplitRow[]): {
  leftRows: SideEntry[];
  rightRows: SideEntry[];
} {
  const leftRows: SideEntry[] = [];
  const rightRows: SideEntry[] = [];
  let hunkIndex = -1;

  for (const row of rows) {
    if (row.kind === "separator") {
      hunkIndex += 1;
      leftRows.push({ kind: "separator", hunkIndex, row });
      rightRows.push({ kind: "separator", hunkIndex, row });
      continue;
    }
    leftRows.push({ kind: "cell", cell: row.left });
    rightRows.push({ kind: "cell", cell: row.right });
  }

  return { leftRows, rightRows };
}

function SplitSide({
  side,
  rows,
  showLineNumbers,
  disableWordDiff,
  isDense,
  activeHunk,
  registerNavigationItems,
}: {
  side: "old" | "new";
  rows: SideEntry[];
  showLineNumbers: boolean;
  disableWordDiff: boolean;
  isDense: boolean;
  activeHunk: string | null;
  /**
   * Only one side registers `data-diffgazer-navigation-item` per hunk so
   * `useNavigation` finds each hunk exactly once (otherwise j/k would
   * skip every other position in split mode).
   */
  registerNavigationItems: boolean;
}) {
  return (
    <div
      data-slot="diff-view-rows"
      data-side={side}
      data-line-numbers={showLineNumbers ? "true" : "false"}
      role="group"
      aria-label={side === "old" ? "Old" : "New"}
      className="scrollbar-thin"
    >
      {rows.map((entry, i) => {
        if (entry.kind === "separator") {
          const { hunkIndex, row } = entry;
          return (
            <span
              key={i}
              data-row
              data-state="hunk"
              data-hunk
              data-diffgazer-navigation-item={registerNavigationItems ? "button" : undefined}
              data-value={registerNavigationItems ? String(hunkIndex) : undefined}
              data-active={activeHunk === String(hunkIndex) ? "true" : undefined}
            >
              {showLineNumbers && (
                <>
                  <span className="diff-num" aria-hidden="true" />
                  {isDense && <span className="diff-num-divider" aria-hidden="true" />}
                </>
              )}
              <span className="diff-marker" aria-hidden="true" />
              <span className="diff-code">{formatHunkHeader(row)}</span>
            </span>
          );
        }

        return (
          <SplitCellRow
            key={i}
            cell={entry.cell}
            showLineNumbers={showLineNumbers}
            disableWordDiff={disableWordDiff}
            isDense={isDense}
          />
        );
      })}
    </div>
  );
}

function SplitCellRow({
  cell,
  showLineNumbers,
  disableWordDiff,
  isDense,
}: {
  cell: SplitCell;
  showLineNumbers: boolean;
  disableWordDiff: boolean;
  isDense: boolean;
}) {
  if (cell.type === "empty") {
    return (
      <span data-row data-state="empty" aria-hidden="true">
        {showLineNumbers && (
          <>
            <span className="diff-num" />
            {isDense && <span className="diff-num-divider" />}
          </>
        )}
        <span className="diff-marker" />
        <span className="diff-code">{" "}</span>
      </span>
    );
  }

  return (
    <span data-row data-state={ROW_STATE[cell.type]}>
      {showLineNumbers && (
        <>
          <span className="diff-num" aria-hidden="true">
            {cell.lineNumber ?? ""}
          </span>
          {isDense && <span className="diff-num-divider" aria-hidden="true" />}
        </>
      )}
      <span className="diff-marker" aria-hidden="true">
        {LINE_PREFIX[cell.type]}
      </span>
      <span className="diff-code">
        {SR_LABEL[cell.type] && (
          <span className="sr-only">{SR_LABEL[cell.type]}</span>
        )}
        <LineContent
          content={cell.content}
          wordSegments={disableWordDiff ? undefined : cell.wordSegments}
          type={cell.type}
        />
      </span>
    </span>
  );
}
