import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { ToastItem, ToastVariant } from "@/types/ui";

export interface Toast extends Omit<ToastItem, "message"> {
  variant: ToastVariant;
  title: string;
  message?: string;
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

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());
  const timeoutIdsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToastRef = useRef<(id: string) => void>(() => {});
  const showToastRef = useRef<(options: Omit<Toast, "id">) => void>(() => {});
  const removeToastRef = useRef<(id: string) => void>(() => {});

  dismissToastRef.current = (id: string) => {
    setDismissingIds((prev) => new Set(prev).add(id));
  };

  showToastRef.current = (options: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    const toast: Toast = { ...options, id };

    setToasts((prev) => [...prev, toast].slice(-MAX_TOASTS));

    if (options.variant !== "error") {
      const duration = options.duration ?? DEFAULT_DURATION;
      const timeoutId = setTimeout(() => dismissToastRef.current(id), duration);
      timeoutIdsRef.current.set(id, timeoutId);
    }
  };

  removeToastRef.current = (id: string) => {
    const timeoutId = timeoutIdsRef.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutIdsRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    setDismissingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const dismissToast = useCallback((id: string) => dismissToastRef.current(id), []);
  const showToast = useCallback((options: Omit<Toast, "id">) => showToastRef.current(options), []);
  const removeToast = useCallback((id: string) => removeToastRef.current(id), []);

  const contextValue = useMemo(
    () => ({ toasts, dismissingIds, showToast, dismissToast, removeToast }),
    [toasts, dismissingIds, showToast, dismissToast, removeToast]
  );

  return <ToastContext.Provider value={contextValue}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
