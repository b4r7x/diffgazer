import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";
import type { SeverityLevel } from "../../types/index.js";

export type { SeverityLevel };

export interface SeverityBarProps {
  label: string;
  count: number;
  max: number;
  severity: SeverityLevel;
  barWidth?: number;
}

const FILLED_CHAR = "\u2588"; // Full block
const EMPTY_CHAR = "\u2591"; // Light shade

export function SeverityBar({
  label,
  count,
  max,
  severity,
  barWidth = 20,
}: SeverityBarProps): ReactElement {
  const { colors } = useTheme();

  const filled = max > 0 ? Math.round((count / max) * barWidth) : 0;
  const empty = barWidth - filled;

  return (
    <Box>
      <Box width={10}>
        <Text color={colors.ui.textMuted}>{label.padEnd(10)}</Text>
      </Box>
      <Text color={colors.severity[severity]}>{FILLED_CHAR.repeat(filled)}</Text>
      <Text color={colors.ui.border}>{EMPTY_CHAR.repeat(empty)}</Text>
      <Text> </Text>
      <Box width={4} justifyContent="flex-end">
        <Text color={colors.severity[severity]} bold>
          {count}
        </Text>
      </Box>
    </Box>
  );
}
