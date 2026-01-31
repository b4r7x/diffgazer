import { useState } from "react";
import type { ToastVariant, ToastItem } from "@repo/schemas/ui";

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
