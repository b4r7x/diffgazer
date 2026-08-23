"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

export interface PagerProps extends ComponentPropsWithRef<"nav"> {}

/** Root nav element with top border and flex layout. */
export function Pager({ className, ref, children, ...props }: PagerProps) {
  return (
    <nav
      ref={ref}
      data-slot="pager"
      aria-label="Page navigation"
      className={cn(
        "flex items-center justify-between gap-4 border-t border-border pt-4",
        className,
      )}
      {...props}
    >
      {children}
    </nav>
  );
}
