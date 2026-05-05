"use client";

import { createContext, useContext } from "react";

interface BlockBarContextValue {
  max: number;
  barWidth: number;
  filledChar: string;
  emptyChar: string;
}

export const BlockBarContext = createContext<BlockBarContextValue | undefined>(
  undefined,
);

export function useBlockBarContext() {
  const context = useContext(BlockBarContext);
  if (!context) {
    throw new Error("BlockBar.Segment must be used within BlockBar");
  }
  return context;
}

export function computeFilledCount(
  value: number,
  max: number,
  barWidth: number,
): number {
  return max > 0
    ? Math.max(0, Math.min(Math.round((value / max) * barWidth), barWidth))
    : 0;
}
