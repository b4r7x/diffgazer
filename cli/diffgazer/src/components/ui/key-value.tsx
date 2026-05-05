import type { ReactNode } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../theme/theme-context.js";

// --- Types ---

export interface KeyValueProps {
  label: string;
  value: ReactNode;
  labelWidth?: number;
}

// --- Component ---

export function KeyValue({ label, value, labelWidth }: KeyValueProps) {
  const { tokens } = useTheme();

  const displayLabel = labelWidth != null
    ? label.padEnd(labelWidth)
    : label;

  return (
    <Box flexDirection="row">
      <Text color={tokens.muted}>{displayLabel}:  </Text>
      {typeof value === "string" || typeof value === "number"
        ? <Text color={tokens.fg}>{value}</Text>
        : value}
    </Box>
  );
}
