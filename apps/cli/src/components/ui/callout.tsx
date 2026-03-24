import type { ReactNode } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../theme/theme-context.js";

export interface CalloutProps {
  variant?: "info" | "warning" | "error" | "success";
  children: ReactNode;
}

export interface CalloutTitleProps {
  children: string;
}

export interface CalloutContentProps {
  children: string;
}

const variantIcons = {
  info: "\u2139",
  warning: "\u26A0",
  error: "\u2716",
  success: "\u2714",
} as const;

function CalloutTitle({ children }: CalloutTitleProps) {
  return <Text bold>{children}</Text>;
}

function CalloutContent({ children }: CalloutContentProps) {
  return <Text>{children}</Text>;
}

export function Callout({ variant = "info", children }: CalloutProps) {
  const { tokens } = useTheme();

  const colorMap = {
    info: tokens.info,
    warning: tokens.warning,
    error: tokens.error,
    success: tokens.success,
  } as const;

  const color = colorMap[variant];
  const icon = variantIcons[variant];

  return (
    <Box
      borderStyle="round"
      borderColor={color}
      paddingX={1}
      flexDirection="row"
      gap={1}
    >
      <Text color={color}>{icon}</Text>
      <Box flexDirection="column">{children}</Box>
    </Box>
  );
}

Callout.Title = CalloutTitle;
Callout.Content = CalloutContent;
