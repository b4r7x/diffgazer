"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type DialogHeaderProps = ComponentProps<"div">;

/**
 * Header strip: a 44px band one surface step above the dialog body, closed by a bottom hairline.
 * Children lay out as a single row, so a Dialog.Title and its optional Dialog.Description subtitle
 * read as one title line. Consumer className overrides (padding, background, flex direction) merge
 * cleanly via tailwind-merge.
 */
export function DialogHeader({ className, children, ...props }: DialogHeaderProps) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex min-h-11 shrink-0 items-center gap-3 border-b border-border bg-[var(--surface-2)] px-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
