import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { useTheme } from "../../theme/provider";

export interface KeyValueProps {
  label: string;
  value: ReactNode;
  labelWidth?: number;
  /** Overrides the muted label hue for rows whose label carries a colour code. */
  labelColor?: string;
}

export function KeyValue({ label, value, labelWidth, labelColor }: KeyValueProps) {
  const { tokens } = useTheme();

  const displayLabel = labelWidth != null ? label.padEnd(labelWidth) : label;

  return (
    <Box flexDirection="row">
      <Box flexShrink={0}>
        <Text color={labelColor ?? tokens.muted}>{`${displayLabel}: `}</Text>
      </Box>
      {typeof value === "string" || typeof value === "number" ? (
        <Text color={tokens.fg}>{value}</Text>
      ) : (
        value
      )}
    </Box>
  );
}
