"use client";

import { createContext, useContext, type RefObject, type KeyboardEvent as ReactKeyboardEvent } from "react";

export interface CommandPaletteContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId: string | null;
  onActivate: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  shouldFilter: boolean;
  filter: (value: string, search: string) => boolean;
  itemCount: number;
  registerItem: (id: string) => void;
  unregisterItem: (id: string) => void;
  setItemCallback: (id: string, onSelect?: () => void) => void;
  getItemCallback: (id: string) => (() => void) | undefined;
  listId: string;
  listRef: RefObject<HTMLDivElement | null>;
  navKeyDown: (event: ReactKeyboardEvent) => void;
}

export const CommandPaletteContext = createContext<CommandPaletteContextValue | undefined>(undefined);

export function useCommandPaletteContext() {
  const context = useContext(CommandPaletteContext);
  if (!context) throw new Error("CommandPalette compound components must be used within a CommandPalette");
  return context;
}
