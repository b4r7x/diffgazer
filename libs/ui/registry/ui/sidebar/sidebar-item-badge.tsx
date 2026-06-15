"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Props for sidebar item badge. */
export interface SidebarItemBadgeProps extends ComponentProps<"span"> {}

// Hidden in rail mode — badges (e.g. "new", counters) don't fit in a 48px rail.
/** Trailing metadata/badge slot for SidebarItem. */
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
