"use client";

import { cn } from "@/lib/utils";

/** Props for menu divider. */
export interface MenuDividerProps {
  /** Class applied to the separator. Renders role="separator" with horizontal orientation. */
  className?: string;
}

/** Visual separator between groups. */
export function MenuDivider({ className }: MenuDividerProps) {
  return (
    <hr
      aria-orientation="horizontal"
      className={cn("my-1 border-t border-border mx-4 opacity-50", className)}
    />
  );
}
