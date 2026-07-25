import { Box, Text } from "ink";
import { useTheme } from "../../theme/provider";
import { Rule } from "./rule";

export interface SectionHeaderProps {
  variant?: "default" | "muted";
  bordered?: boolean;
  bold?: boolean;
  children: string;
}

export function SectionHeader({
  variant = "default",
  bordered = false,
  bold = true,
  children,
}: SectionHeaderProps) {
  const { tokens } = useTheme();

  const color = variant === "muted" ? tokens.muted : tokens.fg;

  return (
    <Box flexDirection="column" flexShrink={0}>
      <Text bold={bold} color={color}>
        {children.toUpperCase()}
      </Text>
      {bordered ? <Rule /> : null}
    </Box>
  );
}
