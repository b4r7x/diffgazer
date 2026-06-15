"use client";

import { createContext, useContext } from "react";

/** Context value shared by block bar. */
interface BlockBarContextValue {
  /** Maximum value the bar represents. Used for aria-valuemax and fill ratio. */
  max: number;
  /** Width of the bar in character cells. Clamped to 0-200. */
  barWidth: number;
  /** Character used for the filled portion of the bar. */
  filledChar: string;
  /** Character used for the empty portion of the bar. */
  emptyChar: string;
}

/** React context backing block bar. */
export const BlockBarContext = createContext<BlockBarContextValue | undefined>(undefined);

/** Reads the block bar context. */
export function useBlockBarContext() {
  const context = useContext(BlockBarContext);
  if (!context) {
    throw new Error("BlockBar.Segment must be used within BlockBar");
  }
  return context;
}

/** Computes filled count. */
export function computeFilledCount(value: number, max: number, barWidth: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;

  const safeBarWidth = Number.isFinite(barWidth) ? Math.max(0, Math.floor(barWidth)) : 0;

  return Math.max(0, Math.min(Math.round((Math.max(0, value) / max) * safeBarWidth), safeBarWidth));
}
