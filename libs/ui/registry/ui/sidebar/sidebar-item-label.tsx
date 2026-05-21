"use client";

import type { HTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

export interface SidebarItemLabelProps extends HTMLAttributes<HTMLSpanElement> {
  ref?: Ref<HTMLSpanElement>;
}

// Hidden in rail mode so items collapse to icon-only rows. The accessible name
// is preserved on the parent `<SidebarItem>` via the `title` attribute, which
// also drives the native tooltip on hover.
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
