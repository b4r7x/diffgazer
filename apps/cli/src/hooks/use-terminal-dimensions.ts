import { useStdout } from "ink";
import { useState, useEffect } from "react";

export interface TerminalDimensions {
  columns: number;
  rows: number;
  isNarrow: boolean;
  isVeryNarrow: boolean;
  isTiny: boolean;
}

export interface UseTerminalDimensionsOptions {
  narrowBreakpoint?: number; // default 90
  veryNarrowBreakpoint?: number; // default 60
  tinyBreakpoint?: number; // default 40
}

const DEFAULT_NARROW_BREAKPOINT = 90;
const DEFAULT_VERY_NARROW_BREAKPOINT = 60;
const DEFAULT_TINY_BREAKPOINT = 40;

export function useTerminalDimensions(
  options?: UseTerminalDimensionsOptions
): TerminalDimensions {
  const { stdout } = useStdout();

  const narrowBreakpoint =
    options?.narrowBreakpoint ?? DEFAULT_NARROW_BREAKPOINT;
  const veryNarrowBreakpoint =
    options?.veryNarrowBreakpoint ?? DEFAULT_VERY_NARROW_BREAKPOINT;
  const tinyBreakpoint =
    options?.tinyBreakpoint ?? DEFAULT_TINY_BREAKPOINT;

  const [dimensions, setDimensions] = useState(() => ({
    columns: stdout?.columns ?? 80,
    rows: stdout?.rows ?? 24,
  }));

  useEffect(() => {
    if (!stdout) return;

    const handleResize = () => {
      setDimensions({
        columns: stdout.columns ?? 80,
        rows: stdout.rows ?? 24,
      });
    };

    stdout.on("resize", handleResize);
    return () => {
      stdout.off("resize", handleResize);
    };
  }, [stdout]);

  const { columns, rows } = dimensions;

  return {
    columns,
    rows,
    isNarrow: columns < narrowBreakpoint,
    isVeryNarrow: columns < veryNarrowBreakpoint,
    isTiny: columns < tinyBreakpoint,
  };
}
