"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Props for callout content. */
export interface CalloutContentProps extends ComponentProps<"div"> {
  /** Body content for the callout. */
  children: ReactNode;
}

/** Body text in muted color. */
export function CalloutContent({ children, className, ...props }: CalloutContentProps) {
  return (
    <div
      data-slot="callout-content"
      className={cn("text-[12px] leading-[1.55] text-muted-foreground", className)}
      {...props}
    >
      {children}
    </div>
  );
}
