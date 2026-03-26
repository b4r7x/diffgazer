export type BreakpointTier = "narrow" | "medium" | "wide";

export const BREAKPOINTS = {
  narrow: { maxColumns: 79, maxPx: 767 },
  medium: { minColumns: 80, maxColumns: 119, minPx: 768, maxPx: 1023 },
  wide: { minColumns: 120, minPx: 1024 },
} as const;

export function getBreakpointTier(columns: number): BreakpointTier {
  if (columns < BREAKPOINTS.medium.minColumns) return "narrow";
  if (columns < BREAKPOINTS.wide.minColumns) return "medium";
  return "wide";
}

export function getBreakpointTierFromPx(px: number): BreakpointTier {
  if (px < BREAKPOINTS.medium.minPx) return "narrow";
  if (px < BREAKPOINTS.wide.minPx) return "medium";
  return "wide";
}
