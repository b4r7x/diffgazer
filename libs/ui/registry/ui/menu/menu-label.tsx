"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MenuLabelProps {
  id?: string;
  children: ReactNode;
  className?: string;
}

export function MenuLabel({ id, children, className }: MenuLabelProps) {
  return (
    <div
      id={id}
      role="presentation"
      className={cn(
        "text-[11px] uppercase tracking-wider text-muted-foreground px-4 py-2 font-mono",
        className,
      )}
    >
      {children}
    </div>
  );
}
