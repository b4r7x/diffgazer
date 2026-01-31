import { useEffect, useState, type ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../../hooks/use-theme.js";
import type { ToastVariant } from "@repo/schemas/ui";

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onDismiss?: () => void;
  isVisible?: boolean;
}

const VARIANT_ICONS: Record<ToastVariant, string> = {
  success: "✓",
  error: "✗",
  warning: "⚠",
  info: "ℹ",
};

export function Toast({
  message,
  variant = "info",
  duration = 3000,
  onDismiss,
  isVisible = true,
}: ToastProps): ReactElement | null {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(isVisible);

  useEffect(() => {
    setVisible(isVisible);
  }, [isVisible]);

  useEffect(() => {
    if (!visible || duration <= 0) return;

    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [visible, duration, onDismiss]);

  if (!visible) {
    return null;
  }

  const variantColors: Record<ToastVariant, string> = {
    success: colors.ui.success,
    error: colors.ui.error,
    warning: colors.ui.warning,
    info: colors.ui.info,
  };

  const color = variantColors[variant];
  const icon = VARIANT_ICONS[variant];

  return (
    <Box
      borderStyle="round"
      borderColor={color}
      paddingX={1}
      width="100%"
    >
      <Text color={color} bold>
        {icon}
      </Text>
      <Text> </Text>
      <Text color={colors.ui.text}>{message}</Text>
    </Box>
  );
}
