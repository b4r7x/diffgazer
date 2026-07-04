"use client";

import { type KeyboardEvent, type RefObject, useMemo } from "react";
import { type ParsedDiff, type SplitCell, type SplitRow, toSplitRows } from "@/lib/diff";
import {
  formatHunkHeader,
  LINE_PREFIX,
  LineContent,
  ROW_STATE,
  resolveSrLabel,
} from "./diff-view-line";

/** Internal split-mode rows renderer. */
export function DiffViewSplit({
  parsed,
  showLineNumbers,
  disableWordDiff,
  isDense,
  activeHunk,
  onKeyDown,
  containerRef,
  regionLabel = "Split diff",
  oldSideLabel,
  newSideLabel,
  addedLineLabel,
  removedLineLabel,
}: {
  parsed: ParsedDiff;
  showLineNumbers: boolean;
  disableWordDiff: boolean;
  isDense: boolean;
  activeHunk: string | null;
  onKeyDown: (e: KeyboardEvent) => void;
  containerRef: RefObject<HTMLDivElement | null>;
  regionLabel?: string;
  oldSideLabel: string;
  newSideLabel: string;
  addedLineLabel: string;
  removedLineLabel: string;
}) {
  const rows: SplitRow[] = useMemo(
    () => toSplitRows(parsed.hunks, !disableWordDiff),
    [disableWordDiff, parsed.hunks],
  );

  const { leftRows, rightRows } = useMemo(() => partitionSplitRows(rows), [rows]);

  return (
    // containerRef on the outer split (not on each SplitSide rows): useNavigation
    // queries by data-diffgazer-navigation-item, which only the left side registers,
    // so one shared ref covers both panes without double-counting hunks.
    // biome-ignore lint/a11y/useSemanticElements: role="region" makes the aria-label/aria-keyshortcuts valid on the focusable diff scroll container (the ScrollArea precedent); <section> would change the styled element and add a document landmark this composite is not.
    <div
      ref={containerRef}
      data-slot="diff-view-split"
      role="region"
      aria-label={regionLabel}
      aria-keyshortcuts="j k Escape"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the container must be focusable (tabIndex=0) to receive j/k/Escape shortcuts that move between diff rows.
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <SplitSide
        side="old"
        label={oldSideLabel}
        rows={leftRows}
        showLineNumbers={showLineNumbers}
        disableWordDiff={disableWordDiff}
        isDense={isDense}
        activeHunk={activeHunk}
        registerNavigationItems
        addedLineLabel={addedLineLabel}
        removedLineLabel={removedLineLabel}
      />
      <SplitSide
        side="new"
        label={newSideLabel}
        rows={rightRows}
        showLineNumbers={showLineNumbers}
        disableWordDiff={disableWordDiff}
        isDense={isDense}
        activeHunk={activeHunk}
        registerNavigationItems={false}
        addedLineLabel={addedLineLabel}
        removedLineLabel={removedLineLabel}
      />
    </div>
  );
}

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
  label,
  rows,
  showLineNumbers,
  disableWordDiff,
  isDense,
  activeHunk,
  registerNavigationItems,
  addedLineLabel,
  removedLineLabel,
}: {
  side: "old" | "new";
  label: string;
  rows: SideEntry[];
  showLineNumbers: boolean;
  disableWordDiff: boolean;
  isDense: boolean;
  activeHunk: string | null;
  registerNavigationItems: boolean;
  addedLineLabel: string;
  removedLineLabel: string;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: role="group" labels one side of the split diff; <fieldset> is for form controls and is not appropriate here.
    <div
      data-slot="diff-view-rows"
      data-side={side}
      data-line-numbers={showLineNumbers ? "true" : "false"}
      role="group"
      aria-label={label}
      className="scrollbar-thin"
    >
      {rows.map((entry, i) => {
        if (entry.kind === "separator") {
          const { hunkIndex, row } = entry;
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: diff rows render in fixed order for an immutable diff and are never reordered; the row index is the stable identity.
              key={i}
              data-row
              data-state="hunk"
              data-hunk
              data-diffgazer-navigation-item={registerNavigationItems ? "button" : undefined}
              data-value={registerNavigationItems ? String(hunkIndex) : undefined}
              data-highlighted={activeHunk === String(hunkIndex) ? "" : undefined}
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
            // biome-ignore lint/suspicious/noArrayIndexKey: diff rows render in fixed order for an immutable diff and are never reordered; the row index is the stable identity.
            key={i}
            cell={entry.cell}
            showLineNumbers={showLineNumbers}
            disableWordDiff={disableWordDiff}
            isDense={isDense}
            addedLineLabel={addedLineLabel}
            removedLineLabel={removedLineLabel}
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
  addedLineLabel,
  removedLineLabel,
}: {
  cell: SplitCell;
  showLineNumbers: boolean;
  disableWordDiff: boolean;
  isDense: boolean;
  addedLineLabel: string;
  removedLineLabel: string;
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

  const srLabel = resolveSrLabel(cell.type, addedLineLabel, removedLineLabel);
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
        {srLabel && <span className="sr-only">{srLabel}</span>}
        <LineContent
          content={cell.content}
          wordSegments={disableWordDiff ? undefined : cell.wordSegments}
          type={cell.type}
        />
      </span>
    </span>
  );
}
