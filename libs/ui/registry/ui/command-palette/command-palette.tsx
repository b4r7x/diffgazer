"use client";

import type { ReactNode } from "react";
import { CommandPaletteContext } from "./command-palette-context";
import {
  type UseCommandPaletteStateOptions,
  useCommandPaletteState,
} from "./use-state";

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
