"use client";

import { useMemo, type KeyboardEvent, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { type AnnotatedChange, type ParsedDiff, annotateWordDiff } from "@/lib/diff";
import { LINE_STYLE, SR_LABEL, LINE_PREFIX, LINE_NUMBER_CLASS, formatHunkHeader, LineContent } from "./diff-view-line.js";

export function UnifiedView({ parsed, showLineNumbers, disableWordDiff, activeHunk, onKeyDown, containerRef }: {
  parsed: ParsedDiff;
  showLineNumbers: boolean;
  disableWordDiff: boolean;
  activeHunk: string | null;
  onKeyDown: (e: KeyboardEvent) => void;
  containerRef: RefObject<HTMLElement | null>;
}) {
  const hunks = useMemo(
    () => parsed.hunks.map((hunk) => ({
      hunk,
      changes: (disableWordDiff ? hunk.changes : annotateWordDiff(hunk.changes)) as AnnotatedChange[],
    })),
    [disableWordDiff, parsed.hunks],
  );

  return (
    <pre
      ref={containerRef as RefObject<never>}
      aria-label="Unified diff"
      aria-keyshortcuts="j k"
      className="p-2 overflow-x-auto focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <code>
        {hunks.map(({ hunk, changes }, hi) => {
          return (
            <div key={hi}>
              <div
                data-hunk
                data-diffgazer-navigation-item="button"
                data-value={String(hi)}
                className={cn(LINE_STYLE.hunk, activeHunk === String(hi) && "ring-1 ring-ring")}
              >
                {formatHunkHeader(hunk)}
              </div>
              {changes.map((change, ci) => (
                <div key={ci} className={LINE_STYLE[change.type]}>
                  {showLineNumbers && (
                    <>
                      <span className={LINE_NUMBER_CLASS} aria-hidden="true">
                        {change.type !== "add" ? change.oldLine : "\u00a0"}
                      </span>
                      <span className={LINE_NUMBER_CLASS} aria-hidden="true">
                        {change.type !== "remove" ? change.newLine : "\u00a0"}
                      </span>
                    </>
                  )}
                  {SR_LABEL[change.type] && <span className="sr-only">{SR_LABEL[change.type]}</span>}
                  <span aria-hidden="true">{LINE_PREFIX[change.type]}</span>
                  <LineContent content={change.content} wordSegments={change.wordSegments} type={change.type} />
                </div>
              ))}
            </div>
          );
        })}
      </code>
    </pre>
  );
}
