"use client";

import { createContext, useContext, type RefObject, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { CommandPaletteItemRegistration } from "./use-command-palette-state";

export interface CommandPaletteContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  highlightedId: string | null;
  onActivate: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  shouldFilter: boolean;
  filter: (value: string, search: string) => boolean;
  itemCount: number;
  listId: string;
  listRef: RefObject<HTMLDivElement | null>;
  navKeyDown: (event: ReactKeyboardEvent) => void;
  registerItem: (item: CommandPaletteItemRegistration) => void;
  unregisterItem: (registrationId: string) => void;
}

export const CommandPaletteContext = createContext<CommandPaletteContextValue | undefined>(undefined);

export function useCommandPaletteContext() {
  const context = useContext(CommandPaletteContext);
  if (!context) throw new Error("CommandPalette compound components must be used within a CommandPalette");
  return context;
}
