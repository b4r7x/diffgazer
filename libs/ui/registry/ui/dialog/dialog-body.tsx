"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export interface DialogBodyProps extends ComponentProps<"div"> {}

/** Scrollable content. */
export function DialogBody({ className, ...props }: DialogBodyProps) {
  return (
    <div
      data-slot="dialog-body"
      // scroll-py mirrors py: focus-driven scrolling (scrollIntoView, Tab) aligns
      // a control flush with the clipped padding-box edge, cutting any focus ring
      // painted outside its border box; scroll-padding keeps it at the resting inset.
      className={cn("flex-1 overflow-y-auto overscroll-contain px-5 py-5 scroll-py-5", className)}
      {...props}
    />
  );
}
