"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Props for sidebar header. */
export interface SidebarHeaderProps extends ComponentProps<"div"> {}

/** Top section with bottom border. */
export function SidebarHeader({ ref, children, className, ...props }: SidebarHeaderProps) {
  return (
    // min-h-11 pins the single-line header to the system's h-11 control row
    // regardless of inherited line-height, so shell headers beside the sidebar
    // can align their hairline to it. Taller content still grows via py-2.
    <div
      ref={ref}
      className={cn(
        "flex min-h-11 items-center px-4 py-2 border-b border-border shrink-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
