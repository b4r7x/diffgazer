import type { ReactNode } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../theme/theme-context.js";

interface EmptyStateProps {
  children: ReactNode;
}

interface EmptyStateMessageProps {
  children: string;
}

interface EmptyStateDescriptionProps {
  children: string;
}

function EmptyStateRoot({ children }: EmptyStateProps) {
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center">
      {children}
    </Box>
  );
}

function EmptyStateMessage({ children }: EmptyStateMessageProps) {
  return <Text bold>{children}</Text>;
}

function EmptyStateDescription({ children }: EmptyStateDescriptionProps) {
  const { tokens } = useTheme();
  return <Text color={tokens.muted}>{children}</Text>;
}

export const EmptyState = Object.assign(EmptyStateRoot, {
  Message: EmptyStateMessage,
  Description: EmptyStateDescription,
});
