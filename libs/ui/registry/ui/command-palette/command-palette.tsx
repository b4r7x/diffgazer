"use client";

import type { ReactNode } from "react";
import { useCommandPaletteState, type UseCommandPaletteStateOptions } from "./use-command-palette-state";
import { CommandPaletteContext } from "./command-palette-context";

export interface CommandPaletteProps extends UseCommandPaletteStateOptions {
  children: ReactNode;
}

export function CommandPalette({
  children,
  ...stateProps
}: CommandPaletteProps) {
  const contextValue = useCommandPaletteState(stateProps);

  return (
    <CommandPaletteContext value={contextValue}>
      {children}
    </CommandPaletteContext>
  );
}
