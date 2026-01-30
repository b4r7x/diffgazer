import type { ReactElement, ReactNode } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

type MetricVariant = "default" | "warning" | "info" | "success" | "error";

export interface MetricItemProps {
  label: string;
  value: ReactNode;
  variant?: MetricVariant;
}

export function MetricItem({
  label,
  value,
  variant = "default",
}: MetricItemProps): ReactElement {
  const { colors } = useTheme();

  const variantColors: Record<MetricVariant, string> = {
    default: colors.ui.text,
    warning: colors.ui.warning,
    info: colors.ui.info,
    success: colors.ui.success,
    error: colors.ui.error,
  };

  return (
    <Box justifyContent="space-between">
      <Text color={colors.ui.textMuted}>{label}</Text>
      <Text color={variantColors[variant]} bold>
        {value}
      </Text>
    </Box>
  );
}
