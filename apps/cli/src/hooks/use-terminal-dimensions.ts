import { useStdout } from "ink";
import { useState, useEffect } from "react";
import { getBreakpointTier, buildResponsiveResult, type ResponsiveResult } from "@diffgazer/core";

interface TerminalDimensions {
  columns: number;
  rows: number;
}

type ResponsiveDimensions = TerminalDimensions & ResponsiveResult;

export function useTerminalDimensions(): TerminalDimensions {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState<TerminalDimensions>({
    columns: stdout.columns ?? 80,
    rows: stdout.rows ?? 24,
  });

  useEffect(() => {
    function onResize() {
      setDimensions({
        columns: stdout.columns ?? 80,
        rows: stdout.rows ?? 24,
      });
    }
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  return dimensions;
}

export function useResponsive(): ResponsiveDimensions {
  const { columns, rows } = useTerminalDimensions();
  const tier = getBreakpointTier(columns);
  return { columns, rows, ...buildResponsiveResult(tier) };
}
