import { createContext, useContext, useState, type ReactNode } from "react";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  dismissingIds: Set<string>;
  showToast: (options: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const DEFAULT_DURATION = 5000;
const MAX_TOASTS = 5;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());

  const showToast = (options: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    const toast: Toast = { ...options, id };

    setToasts(prev => [...prev, toast].slice(-MAX_TOASTS));

    // Auto-dismiss for non-errors
    if (options.variant !== "error") {
      const duration = options.duration ?? DEFAULT_DURATION;
      setTimeout(() => dismissToast(id), duration);
    }
  };

  const dismissToast = (id: string) => {
    setDismissingIds(prev => new Set(prev).add(id));
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    setDismissingIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  return (
    <ToastContext.Provider value={{ toasts, dismissingIds, showToast, dismissToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
