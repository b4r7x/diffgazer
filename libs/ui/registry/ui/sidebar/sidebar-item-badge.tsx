"use client";

import type { HTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

export interface SidebarItemBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  ref?: Ref<HTMLSpanElement>;
}

export function SidebarItemBadge({ ref, children, className, ...rest }: SidebarItemBadgeProps) {
  return <span ref={ref} className={cn("ml-auto shrink-0", className)} {...rest}>{children}</span>;
}
