"use client";

import type { ReactNode, Ref } from "react";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { useCommandPaletteContext } from "./command-palette-context";

export interface CommandPaletteListProps {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  ref?: Ref<HTMLDivElement>;
}

export function CommandPaletteList({
  children,
  className,
  "aria-label": ariaLabel = "Command results",
  ref,
}: CommandPaletteListProps) {
  const { listRef, listId } = useCommandPaletteContext();
  return (
    <div
      id={listId}
      ref={composeRefs(listRef, ref)}
      role="listbox"
      aria-label={ariaLabel}
      data-slot="command-palette-list"
      className={cn("flex-1 overflow-y-auto", className)}
    >
      {children}
    </div>
  );
}
