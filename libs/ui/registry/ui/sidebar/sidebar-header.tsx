"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Props for sidebar header. */
export interface SidebarHeaderProps extends ComponentProps<"div"> {}

/** Top section with bottom border. */
export function SidebarHeader({ ref, children, className, ...props }: SidebarHeaderProps) {
  return (
    <div
      ref={ref}
      className={cn("px-4 py-3 border-b border-border shrink-0", className)}
      {...props}
    >
      {children}
    </div>
  );
}
