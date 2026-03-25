import { useStdout } from "ink";

export const NARROW_THRESHOLD = 80;
export const WIDE_THRESHOLD = 100;

interface TerminalDimensions {
  columns: number;
  rows: number;
}

interface ResponsiveDimensions extends TerminalDimensions {
  isNarrow: boolean;
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
  return {
    columns,
    rows,
    isNarrow: columns < NARROW_THRESHOLD,
    isWide: columns >= WIDE_THRESHOLD,
  };
}
