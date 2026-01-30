import { useEffect, useState, type ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

type ToastVariant = "success" | "error" | "warning" | "info";

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

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export interface ToastItem {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

export function ToastContainer({
  toasts,
  onDismiss,
}: ToastContainerProps): ReactElement {
  return (
    <Box flexDirection="column" gap={1}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          variant={toast.variant}
          duration={toast.duration}
          onDismiss={() => onDismiss(toast.id)}
        />
      ))}
    </Box>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (
    message: string,
    variant: ToastVariant = "info",
    duration = 3000
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, variant, duration }]);
    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const success = (message: string, duration?: number) =>
    addToast(message, "success", duration);

  const error = (message: string, duration?: number) =>
    addToast(message, "error", duration);

  const warning = (message: string, duration?: number) =>
    addToast(message, "warning", duration);

  const info = (message: string, duration?: number) =>
    addToast(message, "info", duration);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };
}
