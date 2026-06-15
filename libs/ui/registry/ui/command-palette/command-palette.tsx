"use client";

import type { ReactNode } from "react";
import { CommandPaletteContext } from "./command-palette-context";
import { type UseCommandPaletteStateOptions, useCommandPaletteState } from "./use-state";

/** Props for command palette. */
export interface CommandPaletteProps extends UseCommandPaletteStateOptions {
  /** Content rendered inside the component. */
  children: ReactNode;
}

/**
 * Terminal-styled command palette with built-in search filtering, grouped items, and keyboard
 * navigation. Uses native dialog element with backdrop blur. Two orthogonal visual axes on
 * Content (frame and density) keep visual chrome configurable without touching internals.
 */
export function CommandPalette({ children, ...stateProps }: CommandPaletteProps) {
  const contextValue = useCommandPaletteState(stateProps);

  return <CommandPaletteContext value={contextValue}>{children}</CommandPaletteContext>;
}
