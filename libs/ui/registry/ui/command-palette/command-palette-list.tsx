"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { cn } from "@/lib/utils";
import { useCommandPaletteContext } from "./command-palette-context";

export interface CommandPaletteListProps
  extends Omit<ComponentPropsWithRef<"div">, "children" | "role" | "id"> {
  /** Content rendered inside the component. */
  children: ReactNode;
  /** Accessible name when no visible label is supplied. */
  "aria-label"?: string;
}

/** Scrollable item container. */
export function CommandPaletteList({
  children,
  className,
  "aria-label": ariaLabel = "Command results",
  ref,
  ...props
}: CommandPaletteListProps) {
  const { listRef, listId } = useCommandPaletteContext();
  const composedRef = useComposedRefs(listRef, ref);
  return (
    <div
      {...props}
      id={listId}
      ref={composedRef}
      role="listbox"
      aria-label={ariaLabel}
      data-slot="command-palette-list"
      className={cn("flex-1 overflow-y-auto overscroll-contain", className)}
    >
      {children}
    </div>
  );
}
