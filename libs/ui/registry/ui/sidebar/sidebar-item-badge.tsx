"use client";

import type { HTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

export interface SidebarItemBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  ref?: Ref<HTMLSpanElement>;
}

// Hidden in rail mode — badges (e.g. "new", counters) don't fit in a 48px rail.
export function SidebarItemBadge({ ref, children, className, ...rest }: SidebarItemBadgeProps) {
  return (
    <span
      ref={ref}
      className={cn("ml-auto shrink-0 group-data-[state=rail]/sidebar:hidden", className)}
      {...rest}
    >
      {children}
    </span>
  );
}
