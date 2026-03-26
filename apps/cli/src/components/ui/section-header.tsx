import type { ReactNode } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../theme/theme-context.js";

export interface SectionHeaderProps {
  variant?: "default" | "muted";
  bordered?: boolean;
  children: string;
}

export function SectionHeader({
  variant = "default",
  bordered = false,
  children,
}: SectionHeaderProps) {
  const { tokens } = useTheme();

  const color = variant === "muted" ? tokens.muted : tokens.fg;

  return (
    <Box flexDirection="column">
      <Text bold color={color}>
        {children.toUpperCase()}
      </Text>
      {bordered ? (
        <Box width="100%" overflowX="hidden">
          <Text color={tokens.border}>{"─".repeat(9999)}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
