import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

type EmptyStateVariant = "centered" | "inline";

interface EmptyStateProps {
  message: string;
  variant?: EmptyStateVariant;
}

export function EmptyState({
  message,
  variant = "centered",
}: EmptyStateProps): ReactElement {
  const { colors } = useTheme();

  if (variant === "inline") {
    return (
      <Text color={colors.ui.textMuted} italic>
        {message}
      </Text>
    );
  }

  return (
    <Box justifyContent="center" paddingY={2}>
      <Text color={colors.ui.textMuted}>{message}</Text>
    </Box>
  );
}
