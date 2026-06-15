"use client";

import type { ReactNode, Ref } from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { cn } from "@/lib/utils";
import { useCommandPaletteContext } from "./command-palette-context";

/** Props for command palette list. */
export interface CommandPaletteListProps {
  /** Content rendered inside the component. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** Accessible name when no visible label is supplied. */
  "aria-label"?: string;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLDivElement>;
}

/** Scrollable item container. */
export function CommandPaletteList({
  children,
  className,
  "aria-label": ariaLabel = "Command results",
  ref,
}: CommandPaletteListProps) {
  const { listRef, listId } = useCommandPaletteContext();
  const composedRef = useComposedRefs(listRef, ref);
  return (
    <div
      id={listId}
      ref={composedRef}
      role="listbox"
      aria-label={ariaLabel}
      data-slot="command-palette-list"
      className={cn("flex-1 overflow-y-auto", className)}
    >
      {children}
    </div>
  );
}
