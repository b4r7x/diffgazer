import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { TriageSeverity } from "@repo/schemas/triage";
import { BAR_FILLED_CHAR, BAR_EMPTY_CHAR, DEFAULT_BAR_WIDTH } from "@repo/schemas/ui";
import { useTheme } from "../../../hooks/use-theme.js";

export interface SeverityBarProps {
  label: string;
  count: number;
  max: number;
  severity: TriageSeverity;
  barWidth?: number;
}

export function SeverityBar({
  label,
  count,
  max,
  severity,
  barWidth = DEFAULT_BAR_WIDTH,
}: SeverityBarProps): ReactElement {
  const { colors } = useTheme();

  const filled = max > 0 ? Math.round((count / max) * barWidth) : 0;
  const empty = barWidth - filled;

  return (
    <Box>
      <Box width={10}>
        <Text color={colors.ui.textMuted}>{label.padEnd(10)}</Text>
      </Box>
      <Text color={colors.severity[severity]}>{BAR_FILLED_CHAR.repeat(filled)}</Text>
      <Text color={colors.ui.border}>{BAR_EMPTY_CHAR.repeat(empty)}</Text>
      <Text> </Text>
      <Box width={4} justifyContent="flex-end">
        <Text color={colors.severity[severity]} bold>
          {count}
        </Text>
      </Box>
    </Box>
  );
}
