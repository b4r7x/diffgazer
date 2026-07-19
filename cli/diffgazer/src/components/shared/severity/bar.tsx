import { SEVERITY_LABELS } from "@diffgazer/core/schemas/presentation";
import type { ReviewSeverity } from "@diffgazer/core/schemas/review";
import { Box, Text } from "ink";
import { useTheme } from "../../../theme/provider";
import { severityColor } from "../../../theme/severity";

export interface SeverityBarProps {
  severity: ReviewSeverity;
  count: number;
  filledCells: number;
  emptyCells: number;
}

export function SeverityBar({ severity, count, filledCells, emptyCells }: SeverityBarProps) {
  const { tokens } = useTheme();
  const color = severityColor(severity, tokens);

  const bar = `${"\u2588".repeat(filledCells)}${"\u2591".repeat(emptyCells)}`;

  const label = SEVERITY_LABELS[severity].padEnd(8);

  return (
    <Box gap={1}>
      <Text color={tokens.fg}>{label}</Text>
      <Text color={color}>{bar}</Text>
      <Text color={tokens.muted}>{count}</Text>
    </Box>
  );
}
