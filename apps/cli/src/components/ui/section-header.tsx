import type { ReactNode } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../theme/theme-context.js";
import { useTerminalDimensions } from "../../hooks/use-terminal-dimensions.js";

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
  const { columns } = useTerminalDimensions();

  const color = variant === "muted" ? tokens.muted : tokens.fg;

  return (
    <Box flexDirection="column">
      <Text bold color={color}>
        {children.toUpperCase()}
      </Text>
      {bordered ? (
        <Text color={tokens.border}>{"─".repeat(columns)}</Text>
      ) : null}
    </Box>
  );
}
