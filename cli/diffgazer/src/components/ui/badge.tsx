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
  size?: "sm" | "md";
  dot?: boolean;
  children: string;
}

const padding: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "",
  md: " ",
};

export function Badge({
  variant = "neutral",
  color: colorOverride,
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

  const color = colorOverride ?? colorMap[variant];
  const pad = padding[size];

  const dotPrefix = dot ? "● " : "";

  return (
    <Box>
      <Text color={color}>
        [{pad}
        {dotPrefix}
      </Text>
      <Text color={color}>{children}</Text>
      <Text color={color}>{pad}]</Text>
    </Box>
  );
}
