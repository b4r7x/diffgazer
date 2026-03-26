import { useStdout } from "ink";
import { getBreakpointTier, type BreakpointTier } from "@diffgazer/core";

interface TerminalDimensions {
  columns: number;
  rows: number;
}

interface ResponsiveDimensions extends TerminalDimensions {
  tier: BreakpointTier;
  isNarrow: boolean;
  isMedium: boolean;
  isWide: boolean;
}

export function useTerminalDimensions(): TerminalDimensions {
  const { stdout } = useStdout();
  return {
    columns: stdout.columns ?? 80,
    rows: stdout.rows ?? 24,
  };
}

export function useResponsive(): ResponsiveDimensions {
  const { columns, rows } = useTerminalDimensions();
  const tier = getBreakpointTier(columns);
  return {
    columns,
    rows,
    tier,
    isNarrow: tier === "narrow",
    isMedium: tier === "medium",
    isWide: tier === "wide",
  };
}
