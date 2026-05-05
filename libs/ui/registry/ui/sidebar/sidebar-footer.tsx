"use client";

import type { HTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";

export interface SidebarFooterProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

export function SidebarFooter({ ref, children, className, ...props }: SidebarFooterProps) {
  return (
    <div ref={ref} className={cn("px-4 py-3 border-t border-border shrink-0 mt-auto", className)} {...props}>
      {children}
    </div>
  );
}