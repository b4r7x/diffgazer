"use client";

import type { ReactNode } from "react";

/** Props for command palette footer. */
export interface CommandPaletteFooterProps {
  /** Content rendered inside the component. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
}

/** Hint bar / status area. */
export function CommandPaletteFooter({ children, className }: CommandPaletteFooterProps) {
  return (
    <div data-slot="command-palette-footer" className={className}>
      {children}
    </div>
  );
}
