import { cn } from "@/lib/utils";
import { useToast } from "./toast-context";
import { Toast } from "./toast";

export function ToastContainer() {
  const { toasts, dismissingIds, dismissToast, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      className={cn(
        "fixed z-50 flex flex-col gap-2 pointer-events-auto",
        "bottom-4 left-4 right-4",
        "sm:left-auto sm:right-8 sm:w-80"
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
