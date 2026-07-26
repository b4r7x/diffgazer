"use client";

import { createContext, useContext } from "react";
import type { CommandPaletteContextValue } from "./use-command-palette-state";

export type { CommandPaletteContextValue } from "./use-command-palette-state";

export const CommandPaletteContext = createContext<CommandPaletteContextValue | undefined>(
  undefined,
);

export function useCommandPaletteContext() {
  const context = useContext(CommandPaletteContext);
  if (!context)
    throw new Error("CommandPalette compound components must be used within a CommandPalette");
  return context;
}
