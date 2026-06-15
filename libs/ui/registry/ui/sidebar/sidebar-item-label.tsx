"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Props for sidebar item label. */
export interface SidebarItemLabelProps extends ComponentProps<"span"> {}

// Hidden in rail mode so items collapse to icon-only rows. The accessible name
// is preserved automatically: SidebarItem renders an sr-only copy of its label
// content that appears in the a11y tree only while the sidebar is in rail state.
/** Truncated text label slot for SidebarItem. */
export function SidebarItemLabel({ ref, children, className, ...rest }: SidebarItemLabelProps) {
  return (
    <span
      ref={ref}
      className={cn("truncate min-w-0 flex-1 group-data-[state=rail]/sidebar:hidden", className)}
      {...rest}
    >
      {children}
    </span>
  );
}
