"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Props for dialog header. */
export interface DialogHeaderProps extends ComponentProps<"div"> {
  /**
   * Header leading marker. "bar" (default) renders a 4px foreground accent bar with flex gap-3
   * outer spacing and a nested text column. "none" is the neutral form - no bar, no gap,
   * children render as direct flex-col descendants - intended for headers with a background
   * color, horizontal title-row layouts, or custom compositions. Consumer className overrides
   * (padding, flex direction, background) merge cleanly on both variants via tailwind-merge.
   */
  marker?: "bar" | "none";
}

/** Header wrapper. */
export function DialogHeader({ className, children, marker = "bar", ...props }: DialogHeaderProps) {
  if (marker === "bar") {
    return (
      <div
        data-slot="dialog-header"
        className={cn("flex gap-3 px-5 pt-4 pb-3 shrink-0", className)}
        {...props}
      >
        <span aria-hidden="true" className="w-1 self-stretch bg-foreground" />
        <div className="flex flex-col gap-1 min-w-0 flex-1">{children}</div>
      </div>
    );
  }

  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1 min-w-0 px-5 pt-4 pb-3 shrink-0", className)}
      {...props}
    >
      {children}
    </div>
  );
}
