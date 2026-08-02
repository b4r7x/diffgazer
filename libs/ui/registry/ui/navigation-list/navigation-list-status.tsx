"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Props for navigation list status. */
export interface NavigationListStatusProps extends ComponentPropsWithoutRef<"span"> {
  /** Top-right status marker. */
  children: ReactNode;
}

/** Top-right status marker. */
export function NavigationListStatus({ children, className, ...props }: NavigationListStatusProps) {
  return (
    <span
      {...props}
      className={cn(
        "col-start-2 row-start-1 self-center text-2xs font-bold text-muted-foreground group-data-[highlighted]:text-primary-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
