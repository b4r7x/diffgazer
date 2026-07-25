export type BreakpointTier = "narrow" | "medium" | "wide";

export const BREAKPOINTS = {
  narrow: { maxColumns: 79 },
  medium: { minColumns: 80, maxColumns: 119 },
  wide: { minColumns: 120 },
} as const;

export function getBreakpointTier(columns: number): BreakpointTier {
  if (columns < BREAKPOINTS.medium.minColumns) return "narrow";
  if (columns < BREAKPOINTS.wide.minColumns) return "medium";
  return "wide";
}

const COMPACT_HEIGHT_MAX_ROWS = 24;

export function isCompactHeight(rows: number): boolean {
  return rows <= COMPACT_HEIGHT_MAX_ROWS;
}

export interface ResponsiveResult {
  tier: BreakpointTier;
  isNarrow: boolean;
  isMedium: boolean;
  isWide: boolean;
}

export function buildResponsiveResult(tier: BreakpointTier): ResponsiveResult {
  return {
    tier,
    isNarrow: tier === "narrow",
    isMedium: tier === "medium",
    isWide: tier === "wide",
  };
}
