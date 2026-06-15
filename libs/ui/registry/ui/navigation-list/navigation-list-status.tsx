"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Props for navigation list status. */
export interface NavigationListStatusProps {
  /** Top-right status marker. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
}

/** Top-right status marker. */
export function NavigationListStatus({ children, className }: NavigationListStatusProps) {
  return (
    <span
      className={cn(
        "col-start-2 row-start-1 self-center text-2xs font-bold text-warning group-data-[highlighted]:text-primary-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
