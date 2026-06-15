"use client";

import { createContext, useContext } from "react";
import type { CommandPaletteContextValue } from "./use-state";

export type { CommandPaletteContextValue } from "./use-state";

/** React context backing command palette. */
export const CommandPaletteContext = createContext<CommandPaletteContextValue | undefined>(
  undefined,
);

/** Reads the command palette context. */
export function useCommandPaletteContext() {
  const context = useContext(CommandPaletteContext);
  if (!context)
    throw new Error("CommandPalette compound components must be used within a CommandPalette");
  return context;
}
