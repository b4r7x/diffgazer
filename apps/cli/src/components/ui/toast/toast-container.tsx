import type { ReactElement } from "react";
import { Box } from "ink";
import type { ToastItem } from "@repo/schemas/ui";
import { Toast } from "./toast.js";

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
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
