"use client";

import type { ChangeType, WordSegment } from "@/lib/diff";

export const LINE_STYLE: Record<ChangeType | "hunk", string | undefined> = {
  remove: "text-destructive",
  add: "text-success",
  context: undefined,
  hunk: "text-muted-foreground bg-muted/20 -mx-2 px-2",
};

export const SR_LABEL: Partial<Record<ChangeType, string>> = {
  add: "Added: ",
  remove: "Removed: ",
};

export const LINE_PREFIX: Record<ChangeType, string> = {
  add: "+",
  remove: "-",
  context: " ",
};

export const LINE_NUMBER_CLASS =
  "inline-block w-8 text-right pr-2 text-muted-foreground select-none";

export function formatHunkHeader(hunk: {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  heading: string;
}): string {
  return `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@${hunk.heading ? ` ${hunk.heading}` : ""}`;
}

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

  const bg =
    type === "add"
      ? "bg-success/20 rounded-sm"
      : "bg-destructive/20 rounded-sm";
  return (
    <>
      {wordSegments.map((seg, i) =>
        seg.changed ? (
          <span key={i} className={bg}>
            {seg.text}
          </span>
        ) : (
          seg.text
        ),
      )}
    </>
  );
}
