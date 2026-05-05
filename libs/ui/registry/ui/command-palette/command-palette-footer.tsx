"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface CommandPaletteFooterProps {
  children: ReactNode;
  className?: string;
}

export function CommandPaletteFooter({ children, className }: CommandPaletteFooterProps) {
  return (
    <div className={cn("border-t border-border/60 bg-secondary/50 p-2 flex justify-between items-center text-[10px] text-muted-foreground font-mono select-none", className)}>
      {children}
    </div>
  );
}
