import type { ReactElement } from "react";
import { Box, Text, useStdout } from "ink";

interface SeparatorProps {
  width?: number | "full";
}

export function Separator({ width = 40 }: SeparatorProps): ReactElement {
  const { stdout } = useStdout();
  const actualWidth = width === "full" ? (stdout?.columns ?? 80) : width;

  return (
    <Box width="100%">
      <Text dimColor>{"─".repeat(actualWidth)}</Text>
    </Box>
  );
}
