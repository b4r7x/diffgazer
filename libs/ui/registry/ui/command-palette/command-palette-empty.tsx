"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useCommandPaletteContext } from "./command-palette-context";

export interface CommandPaletteEmptyProps {
  children: ReactNode;
  className?: string;
}

export function CommandPaletteEmpty({ children, className }: CommandPaletteEmptyProps) {
  const { itemCount, search } = useCommandPaletteContext();
  if (itemCount > 0 || !search) return null;
  return (
    <div role="status" aria-live="polite" className={cn("py-6 text-center text-sm text-muted-foreground", className)}>
      {children}
    </div>
  );
}
