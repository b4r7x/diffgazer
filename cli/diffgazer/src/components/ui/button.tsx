import type { ReactNode } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import { useTheme } from "../../theme/theme-context.js";

export interface ButtonProps {
  variant?: "primary" | "secondary" | "destructive" | "success" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  bracket?: boolean;
  loading?: boolean;
  disabled?: boolean;
  isActive?: boolean;
  onPress?: () => void;
  children: string;
}

const paddingBySize = {
  sm: { x: 0, y: 0 },
  md: { x: 1, y: 0 },
  lg: { x: 2, y: 0 },
} as const;

export function Button({
  variant = "primary",
  size = "md",
  bracket = true,
  loading = false,
  disabled = false,
  isActive = false,
  onPress,
  children,
}: ButtonProps) {
  const { tokens } = useTheme();

  const variantColor: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary: tokens.accent,
    secondary: tokens.muted,
    destructive: tokens.error,
    success: tokens.success,
    ghost: tokens.fg,
    outline: tokens.border,
  };

  const color = variantColor[variant];
  const pad = paddingBySize[size];
  const interactive = isActive && !disabled && !loading;

  useInput(
    (_input, key) => {
      if (key.return && onPress) {
        onPress();
      }
    },
    { isActive: interactive },
  );

  return (
    <Box paddingX={pad.x} paddingY={pad.y}>
      <Text
        color={interactive ? tokens.fg : color}
        backgroundColor={interactive ? color : undefined}
        bold={interactive}
        dimColor={disabled}
      >
        {loading ? (
          <>
            <Spinner type="dots" />
            <Text>{" "}</Text>
          </>
        ) : null}
        {bracket ? "[ " : "> "}
        {children}
        {bracket ? " ]" : ""}
      </Text>
    </Box>
  );
}
