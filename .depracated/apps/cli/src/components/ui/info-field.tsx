import type { ReactElement, ReactNode } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

type InfoFieldColor = "blue" | "violet" | "green" | "yellow" | "red" | "muted";

interface InfoFieldProps {
  label: string;
  color?: InfoFieldColor;
  children: ReactNode;
}

export function InfoField({
  label,
  color = "muted",
  children,
}: InfoFieldProps): ReactElement {
  const { colors } = useTheme();

  const colorMap: Record<InfoFieldColor, string> = {
    blue: colors.ui.info,
    violet: colors.ui.accent,
    green: colors.ui.success,
    yellow: colors.ui.warning,
    red: colors.ui.error,
    muted: colors.ui.textMuted,
  };

  return (
    <Box flexDirection="column">
      <Text color={colorMap[color]} bold>
        {label.toUpperCase()}
      </Text>
      {typeof children === "string" ? (
        <Text color={colors.ui.text}>{children}</Text>
      ) : (
        children
      )}
    </Box>
  );
}
