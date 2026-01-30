import type { ReactElement, ReactNode } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

export interface StatusRowProps {
  label: string;
  value: ReactNode;
  dotLeader?: boolean;
  width?: number;
}

export function StatusRow({
  label,
  value,
  dotLeader = false,
  width,
}: StatusRowProps): ReactElement {
  const { colors } = useTheme();

  if (dotLeader && width) {
    const labelLen = label.length;
    const valueStr = typeof value === "string" ? value : "";
    const valueLen = valueStr.length;
    const dotsNeeded = Math.max(2, width - labelLen - valueLen - 2);
    const dots = " " + ".".repeat(dotsNeeded) + " ";

    return (
      <Box>
        <Text color={colors.ui.textMuted}>{label}</Text>
        <Text color={colors.ui.textDim}>{dots}</Text>
        <Text color={colors.ui.text}>{value}</Text>
      </Box>
    );
  }

  return (
    <Box justifyContent="space-between" width={width}>
      <Text color={colors.ui.textMuted}>{label}</Text>
      <Text color={colors.ui.text}>{value}</Text>
    </Box>
  );
}
