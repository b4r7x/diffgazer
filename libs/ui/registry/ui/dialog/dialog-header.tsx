"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface DialogHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * "bar" (default) renders a 4px foreground accent bar spanning the title and
   * description column — the decorated header form.
   * "none" is the neutral form intended for headers with a background, custom
   * horizontal layouts, or compositions where the bar would clash. Consumer
   * className overrides (padding, flex direction, background) merge cleanly on
   * both variants via tailwind-merge.
   *
   * "bar" currently renders in foreground color. Severity-aware coloring
   * (warning/destructive) is reserved for a future iteration; do not rely on
   * the bar's color for semantic state.
   */
  marker?: "bar" | "none";
}

export function DialogHeader({
  className,
  children,
  marker = "bar",
  ...props
}: DialogHeaderProps) {
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
