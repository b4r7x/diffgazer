export type BreakpointTier = "narrow" | "medium" | "wide";

const MEDIUM_MIN_COLUMNS = 80;
const WIDE_MIN_COLUMNS = 120;

export function getBreakpointTier(columns: number): BreakpointTier {
  if (columns < MEDIUM_MIN_COLUMNS) return "narrow";
  if (columns < WIDE_MIN_COLUMNS) return "medium";
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
