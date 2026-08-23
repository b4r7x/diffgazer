"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MenuLabelProps {
  /** ID applied to the rendered element. */
  id?: string;
  /** Label text for a MenuGroup. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
}

/** Group label text. */
export function MenuLabel({ id, children, className }: MenuLabelProps) {
  return (
    <div
      id={id}
      role="presentation"
      className={cn(
        "text-2xs uppercase tracking-wider text-muted-foreground px-4 py-2 font-mono",
        className,
      )}
    >
      {children}
    </div>
  );
}
