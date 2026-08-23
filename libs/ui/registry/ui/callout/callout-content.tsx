"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CalloutContentProps extends ComponentProps<"div"> {
  /** Body content for the callout. */
  children: ReactNode;
}

/** Body text in muted color. */
export function CalloutContent({ children, className, ...props }: CalloutContentProps) {
  return (
    <div
      data-slot="callout-content"
      // em-relative (12/13) so the root font-size stays the single sizing knob.
      className={cn("text-[0.923em] leading-[1.55] text-muted-foreground", className)}
      {...props}
    >
      {children}
    </div>
  );
}
