import type { ReactNode } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../theme/theme-context.js";

export interface BadgeProps {
  variant?: "success" | "warning" | "error" | "info" | "neutral";
  size?: "sm" | "md" | "lg";
  dot?: boolean;
  children: string;
}

const padding: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "",
  md: " ",
  lg: "  ",
};

export function Badge({
  variant = "neutral",
  size = "sm",
  dot = false,
  children,
}: BadgeProps) {
  const { tokens } = useTheme();

  const colorMap = {
    success: tokens.success,
    warning: tokens.warning,
    error: tokens.error,
    info: tokens.info,
    neutral: tokens.muted,
  } as const;

  const color = colorMap[variant];
  const pad = padding[size];

  const dotPrefix = dot ? "● " : "";

  return (
    <Box>
      <Text color={color}>
        [{pad}{dotPrefix}
      </Text>
      <Text color={color}>{children}</Text>
      <Text color={color}>{pad}]</Text>
    </Box>
  );
}
