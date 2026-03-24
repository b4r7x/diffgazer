import { useStdout } from "ink";

interface TerminalDimensions {
  columns: number;
  rows: number;
}

export function useTerminalDimensions(): TerminalDimensions {
  const { stdout } = useStdout();
  return {
    columns: stdout.columns ?? 80,
    rows: stdout.rows ?? 24,
  };
}
