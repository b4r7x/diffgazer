import { cn } from "../../lib/cn";
import { useToastData, useToastActions, type ToastPosition } from "./toast-context";
import { Toast } from "./toast";

const positionClasses: Record<ToastPosition, string> = {
  "top-left": "top-4 left-4 right-4 sm:right-auto sm:left-8 sm:w-80",
  "top-right": "top-4 left-4 right-4 sm:left-auto sm:right-8 sm:w-80",
  "bottom-left": "bottom-4 left-4 right-4 sm:right-auto sm:left-8 sm:w-80",
  "bottom-right": "bottom-4 left-4 right-4 sm:left-auto sm:right-8 sm:w-80",
};

export function ToastContainerPortal({ position = "bottom-right" }: { position?: ToastPosition }) {
  const { toasts, dismissingIds } = useToastData();
  const { dismissToast, removeToast } = useToastActions();

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      className={cn(
        "fixed z-50 flex flex-col gap-2 pointer-events-auto",
        positionClasses[position]
      )}
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onDismiss={dismissToast}
          onRemove={removeToast}
          dismissing={dismissingIds.has(toast.id)}
        />
      ))}
    </div>
  );
}
