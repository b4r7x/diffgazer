import type { BadgeVariant } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import { useTheme } from "../../theme/provider";

export interface BadgeProps {
  variant?: BadgeVariant;
  /**
   * Overrides the variant hue. A status hue cannot survive a selection fill, so
   * rows on a highlighted background pass the row tone here and lean on the
   * badge label to carry the status.
   */
  color?: string;
  dot?: boolean;
  children: string;
}

export function Badge({
  variant = "neutral",
  color: colorOverride,
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

  const color = colorOverride ?? colorMap[variant];
  const dotPrefix = dot ? "● " : "";

  return (
    <Box>
      <Text color={color}>[{dotPrefix}</Text>
      <Text color={color}>{children}</Text>
      <Text color={color}>]</Text>
    </Box>
  );
}
