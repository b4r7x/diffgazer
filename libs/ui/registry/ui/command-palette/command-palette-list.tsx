"use client";

import { cn } from "@/lib/utils";
import { composeRefs } from "@/lib/compose-refs";
import { useCommandPaletteContext } from "./command-palette-context";
import type { ReactNode, Ref } from "react";

export interface CommandPaletteListProps {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  ref?: Ref<HTMLDivElement>;
}

export function CommandPaletteList({ children, className, "aria-label": ariaLabel = "Command results", ref }: CommandPaletteListProps) {
  const { listRef, listId } = useCommandPaletteContext();
  return (
    <div
      id={listId}
      ref={composeRefs(listRef, ref)}
      role="listbox"
      aria-label={ariaLabel}
      className={cn("flex-1 overflow-y-auto p-2 space-y-1", className)}
    >
      {children}
    </div>
  );
}
