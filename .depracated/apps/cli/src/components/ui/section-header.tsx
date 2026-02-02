import type { ReactElement, ReactNode } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

interface SectionHeaderProps {
  children: ReactNode;
}

export function SectionHeader({ children }: SectionHeaderProps): ReactElement {
  const { colors } = useTheme();

  return (
    <Box marginBottom={1}>
      <Text color={colors.ui.accent} bold>
        {String(children).toUpperCase()}
      </Text>
    </Box>
  );
}
