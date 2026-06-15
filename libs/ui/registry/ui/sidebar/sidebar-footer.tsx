"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Props for sidebar footer. */
export interface SidebarFooterProps extends ComponentProps<"div"> {}

/** Bottom section with top border. */
export function SidebarFooter({ ref, children, className, ...props }: SidebarFooterProps) {
  return (
    <div
      ref={ref}
      className={cn("px-4 py-3 border-t border-border shrink-0 mt-auto", className)}
      {...props}
    >
      {children}
    </div>
  );
}
