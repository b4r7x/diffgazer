"use client";

import type { ChangeType, WordSegment } from "@/lib/diff";

/** Allowed diff row state values. */
export type DiffRowState = "added" | "removed" | "context" | "hunk" | "empty";

/** Root <figure> with aria-roledescription="diff". */
export const ROW_STATE: Record<ChangeType, DiffRowState> = {
  add: "added",
  remove: "removed",
  context: "context",
};

/** Resolves sr label. */
export function resolveSrLabel(
  type: ChangeType,
  addedLineLabel: string,
  removedLineLabel: string,
): string | undefined {
  if (type === "add") return addedLineLabel;
  if (type === "remove") return removedLineLabel;
  return undefined;
}

/** Root <figure> with aria-roledescription="diff". */
export const LINE_PREFIX: Record<ChangeType, string> = {
  add: "+",
  // U+2212 MINUS SIGN — visually balanced with "+", and copy-paste keeps
  // a clearly minus-shaped glyph for downstream tools (delta / git compat).
  remove: "−",
  context: " ",
};

/** Root <figure> with aria-roledescription="diff". */
export function formatHunkHeader(hunk: {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  heading: string;
}): string {
  return `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@${hunk.heading ? ` ${hunk.heading}` : ""}`;
}

/** Root <figure> with aria-roledescription="diff". */
export function LineContent({
  content,
  wordSegments,
  type,
}: {
  content: string;
  wordSegments: WordSegment[] | undefined;
  type: ChangeType;
}) {
  if (!wordSegments || (type !== "add" && type !== "remove")) {
    return <>{content}</>;
  }

  const word = type === "add" ? "added" : "removed";
  return (
    <>
      {wordSegments.map((seg, i) =>
        seg.changed ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: word-diff segments render in fixed order within an immutable line and are never reordered; the segment index is the stable identity.
          <span key={i} data-word={word}>
            {seg.text}
          </span>
        ) : (
          seg.text
        ),
      )}
    </>
  );
}
