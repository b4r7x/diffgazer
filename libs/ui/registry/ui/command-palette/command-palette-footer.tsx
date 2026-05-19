"use client";

import type { ReactNode } from "react";

export interface CommandPaletteFooterProps {
  children: ReactNode;
  className?: string;
}

export function CommandPaletteFooter({ children, className }: CommandPaletteFooterProps) {
  return (
    <div data-slot="command-palette-footer" className={className}>
      {children}
    </div>
  );
}
