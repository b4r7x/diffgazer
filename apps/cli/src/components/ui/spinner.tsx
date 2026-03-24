import type { ReactNode } from "react";
import { Box, Text } from "ink";
import InkSpinner from "ink-spinner";
import { useTheme } from "../../theme/theme-context.js";

export interface SpinnerProps {
  variant?: "dots" | "braille" | "snake";
  label?: string;
  size?: "sm" | "md" | "lg";
}

const variantToType = {
  dots: "dots",
  braille: "dots8Bit",
  snake: "line",
} as const;

const gapBySize = {
  sm: 0,
  md: 1,
  lg: 2,
} as const;

export function Spinner({
  variant = "dots",
  label,
  size = "md",
}: SpinnerProps) {
  const { tokens } = useTheme();

  const spinnerType = variantToType[variant];
  const gap = gapBySize[size];

  return (
    <Box flexDirection="row" gap={gap}>
      <Text color={tokens.accent}>
        <InkSpinner type={spinnerType} />
      </Text>
      {label != null ? <Text>{label}</Text> : null}
    </Box>
  );
}
