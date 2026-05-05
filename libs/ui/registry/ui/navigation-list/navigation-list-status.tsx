"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface NavigationListStatusProps {
  children: ReactNode;
  className?: string;
}

export function NavigationListStatus({ children, className }: NavigationListStatusProps) {
  return (
    <span className={cn("col-start-2 row-start-1 self-center text-[10px] font-bold text-warning group-data-[active]:text-background", className)}>
      {children}
    </span>
  );
}
