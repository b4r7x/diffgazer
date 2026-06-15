"use client";

import type { ReactNode } from "react";
import { useCommandPaletteContext } from "./command-palette-context";

/** Props for command palette empty. */
export interface CommandPaletteEmptyProps {
  /** Content rendered inside the component. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
}

/** Shown when no items match search. */
export function CommandPaletteEmpty({ children, className }: CommandPaletteEmptyProps) {
  const { itemCount, search } = useCommandPaletteContext();
  if (itemCount > 0 || !search) return null;
  return (
    // The no-results announcement is owned by CommandPaletteContent's single live
    // region; this presentational node is just the visible empty-state copy and
    // must not be an invalid live-region child of the listbox.
    <div role="presentation" data-slot="command-palette-empty" className={className}>
      {children}
    </div>
  );
}
