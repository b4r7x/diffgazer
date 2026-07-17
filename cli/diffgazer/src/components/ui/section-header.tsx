import { Box, Text } from "ink";
import { useTheme } from "../../theme/provider";

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
      {bordered ? (
        <Box
          width="100%"
          borderStyle="single"
          borderColor={tokens.border}
          borderTop
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
        />
      ) : null}
    </Box>
  );
}
