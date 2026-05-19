"use client";

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
    <div role="status" aria-live="polite" data-slot="command-palette-empty" className={className}>
      {children}
    </div>
  );
}
