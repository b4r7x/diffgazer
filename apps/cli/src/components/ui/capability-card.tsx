import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

export interface CapabilityCardProps {
  label: string;
  value: string;
}

export function CapabilityCard({ label, value }: CapabilityCardProps): ReactElement {
  const { colors } = useTheme();

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={colors.ui.border}
      paddingX={1}
    >
      <Text color={colors.ui.textMuted} dimColor italic>
        {label}
      </Text>
      <Text color={colors.ui.text}>{value}</Text>
    </Box>
  );
}
