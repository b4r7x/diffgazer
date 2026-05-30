import { Box, Text } from "ink";
import type { ReviewSeverity } from "@diffgazer/core/schemas/review";
import { useTheme } from "../../../theme/theme-context";
import { severityColor } from "../../../theme/severity";

export interface SeverityBarProps {
  severity: ReviewSeverity;
  count: number;
  total: number;
}

const BAR_WIDTH = 20;

export function SeverityBar({ severity, count, total }: SeverityBarProps) {
  const { tokens } = useTheme();
  const color = severityColor(severity, tokens);

  const filled = total > 0 ? Math.round((count / total) * BAR_WIDTH) : 0;
  const bar = "\u2588".repeat(filled);

  const label = severity.padEnd(8);

  return (
    <Box gap={1}>
      <Text color={tokens.fg}>{label}</Text>
      <Text color={color}>{bar}</Text>
      <Text color={tokens.muted}>{count}</Text>
    </Box>
  );
}
