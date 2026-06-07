"use client";

import { type KeyboardEvent, type RefObject, useMemo } from "react";
import {
  type AnnotatedChange,
  annotateWordDiff,
  createWordDiffBudget,
  type ParsedDiff,
} from "@/lib/diff";
import { formatHunkHeader, LINE_PREFIX, LineContent, ROW_STATE, SR_LABEL } from "./diff-view-line";

type UnifiedHunk = { hunk: ParsedDiff["hunks"][number]; changes: AnnotatedChange[] };

export function UnifiedView({
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
  const hunks: UnifiedHunk[] = useMemo(() => {
    const budget = createWordDiffBudget();
    return parsed.hunks.map((hunk) => ({
      hunk,
      changes: disableWordDiff ? hunk.changes : annotateWordDiff(hunk.changes, budget),
    }));
  }, [disableWordDiff, parsed.hunks]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the diff viewer is a custom keyboard-navigable composite; row navigation is handled here via onKeyDown with no native role that fits.
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-label/aria-keyshortcuts describe the focusable diff navigation region; no role with a native element equivalent applies to this composite.
    <div
      ref={containerRef}
      data-slot="diff-view-rows"
      data-line-numbers={showLineNumbers ? "true" : "false"}
      aria-label="Unified diff"
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
}: {
  hunk: ParsedDiff["hunks"][number];
  changes: AnnotatedChange[];
  hunkIndex: number;
  showLineNumbers: boolean;
  isDense: boolean;
  isActive: boolean;
}) {
  return (
    <>
      <span
        data-row
        data-state="hunk"
        data-hunk
        data-diffgazer-navigation-item="button"
        data-value={String(hunkIndex)}
        data-active={isActive ? "true" : undefined}
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
      {changes.map((change, ci) => (
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
            {SR_LABEL[change.type] && <span className="sr-only">{SR_LABEL[change.type]}</span>}
            <LineContent
              content={change.content}
              wordSegments={change.wordSegments}
              type={change.type}
            />
          </span>
        </span>
      ))}
    </>
  );
}
