"use client";

import type { HTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

export interface SidebarHeaderProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

export function SidebarHeader({ ref, children, className, ...props }: SidebarHeaderProps) {
  return (
    <div ref={ref} className={cn("px-4 py-3 border-b border-border shrink-0", className)} {...props}>
      {children}
    </div>
  );
}