"use client";

import { type KeyboardEvent, type RefObject, useMemo } from "react";
import {
  type AnnotatedChange,
  annotateWordDiff,
  createWordDiffBudget,
  type ParsedDiff,
} from "@/lib/diff";
import {
  formatHunkHeader,
  LINE_PREFIX,
  LineContent,
  ROW_STATE,
  resolveSrLabel,
} from "./diff-view-line";

type UnifiedHunk = { hunk: ParsedDiff["hunks"][number]; changes: AnnotatedChange[] };

/** Internal unified rows renderer. */
export function DiffViewUnified({
  parsed,
  showLineNumbers,
  disableWordDiff,
  isDense,
  activeHunk,
  onKeyDown,
  containerRef,
  regionLabel = "Unified diff",
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
  addedLineLabel: string;
  removedLineLabel: string;
}) {
  const hunks: UnifiedHunk[] = useMemo(() => {
    const budget = createWordDiffBudget();
    return parsed.hunks.map((hunk) => ({
      hunk,
      changes: disableWordDiff ? hunk.changes : annotateWordDiff(hunk.changes, budget),
    }));
  }, [disableWordDiff, parsed.hunks]);

  return (
    // biome-ignore lint/a11y/useSemanticElements: role="region" makes the aria-label/aria-keyshortcuts valid on the focusable diff scroll container (the ScrollArea precedent); <section> would change the styled element and add a document landmark this composite is not.
    <div
      ref={containerRef}
      data-slot="diff-view-rows"
      data-line-numbers={showLineNumbers ? "true" : "false"}
      role="region"
      aria-label={regionLabel}
      aria-keyshortcuts="j k Escape"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the container must be focusable (tabIndex=0) to receive j/k/Escape shortcuts that move between diff rows.
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="scrollbar-thin"
    >
      {hunks.map(({ hunk, changes }, hi) => (
        <UnifiedHunkBlock
          // biome-ignore lint/suspicious/noArrayIndexKey: diff hunks render in fixed order for an immutable diff and are never reordered; the hunk index is the stable identity.
          key={hi}
          hunk={hunk}
          changes={changes}
          hunkIndex={hi}
          showLineNumbers={showLineNumbers}
          isDense={isDense}
          isActive={activeHunk === String(hi)}
          addedLineLabel={addedLineLabel}
          removedLineLabel={removedLineLabel}
        />
      ))}
    </div>
  );
}

function UnifiedHunkBlock({
  hunk,
  changes,
  hunkIndex,
  showLineNumbers,
  isDense,
  isActive,
  addedLineLabel,
  removedLineLabel,
}: {
  hunk: ParsedDiff["hunks"][number];
  changes: AnnotatedChange[];
  hunkIndex: number;
  showLineNumbers: boolean;
  isDense: boolean;
  isActive: boolean;
  addedLineLabel: string;
  removedLineLabel: string;
}) {
  return (
    <>
      <span
        data-row
        data-state="hunk"
        data-hunk
        data-diffgazer-navigation-item="button"
        data-value={String(hunkIndex)}
        data-highlighted={isActive ? "" : undefined}
      >
        {showLineNumbers && (
          <>
            <span className="diff-num" aria-hidden="true" />
            {isDense && <span className="diff-num-divider" aria-hidden="true" />}
            <span className="diff-num" aria-hidden="true" />
            {isDense && <span className="diff-num-divider" aria-hidden="true" />}
          </>
        )}
        <span className="diff-marker" aria-hidden="true" />
        <span className="diff-code">{formatHunkHeader(hunk)}</span>
      </span>
      {changes.map((change, ci) => {
        const srLabel = resolveSrLabel(change.type, addedLineLabel, removedLineLabel);
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: diff change rows render in fixed order within an immutable hunk and are never reordered; the change index is the stable identity.
            key={ci}
            data-row
            data-state={ROW_STATE[change.type]}
            data-line-old={change.oldLine ?? undefined}
            data-line-new={change.newLine ?? undefined}
          >
            {showLineNumbers && (
              <>
                <span className="diff-num" aria-hidden="true">
                  {change.type !== "add" ? change.oldLine : ""}
                </span>
                {isDense && <span className="diff-num-divider" aria-hidden="true" />}
                <span className="diff-num" aria-hidden="true">
                  {change.type !== "remove" ? change.newLine : ""}
                </span>
                {isDense && <span className="diff-num-divider" aria-hidden="true" />}
              </>
            )}
            <span className="diff-marker" aria-hidden="true">
              {LINE_PREFIX[change.type]}
            </span>
            <span className="diff-code">
              {srLabel && <span className="sr-only">{srLabel}</span>}
              <LineContent
                content={change.content}
                wordSegments={change.wordSegments}
                type={change.type}
              />
            </span>
          </span>
        );
      })}
    </>
  );
}
