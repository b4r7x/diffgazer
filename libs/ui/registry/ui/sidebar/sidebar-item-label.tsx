"use client";

import type { HTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

export interface SidebarItemLabelProps extends HTMLAttributes<HTMLSpanElement> {
  ref?: Ref<HTMLSpanElement>;
}

export function SidebarItemLabel({ ref, children, className, ...rest }: SidebarItemLabelProps) {
  return <span ref={ref} className={cn("truncate min-w-0 flex-1", className)} {...rest}>{children}</span>;
}
