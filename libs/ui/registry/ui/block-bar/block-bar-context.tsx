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
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;

  const safeBarWidth = Number.isFinite(barWidth)
    ? Math.max(0, Math.floor(barWidth))
    : 0;

  return Math.max(
    0,
    Math.min(Math.round((Math.max(0, value) / max) * safeBarWidth), safeBarWidth),
  );
}
