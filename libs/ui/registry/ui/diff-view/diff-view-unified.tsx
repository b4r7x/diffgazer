"use client";

import { useMemo, type KeyboardEvent, type RefObject } from "react";
import {
  type AnnotatedChange,
  type ParsedDiff,
  annotateWordDiff,
  createWordDiffBudget,
} from "@/lib/diff";
import {
  LINE_PREFIX,
  ROW_STATE,
  SR_LABEL,
  formatHunkHeader,
  LineContent,
} from "./diff-view-line";

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
    <div
      ref={containerRef}
      data-slot="diff-view-rows"
      data-line-numbers={showLineNumbers ? "true" : "false"}
      aria-label="Unified diff"
      aria-keyshortcuts="j k Escape"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="scrollbar-thin"
    >
      {hunks.map(({ hunk, changes }, hi) => (
        <UnifiedHunkBlock
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
            {SR_LABEL[change.type] && (
              <span className="sr-only">{SR_LABEL[change.type]}</span>
            )}
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
