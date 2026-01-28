import { createContext, useContext, useRef, useState, useMemo, useCallback, type ReactNode } from "react";

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
  const timeoutIdsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setDismissingIds(prev => new Set(prev).add(id));
  }, []);

  const showToast = useCallback((options: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    const toast: Toast = { ...options, id };

    setToasts(prev => [...prev, toast].slice(-MAX_TOASTS));

    // Auto-dismiss for non-errors
    if (options.variant !== "error") {
      const duration = options.duration ?? DEFAULT_DURATION;
      const timeoutId = setTimeout(() => dismissToast(id), duration);
      timeoutIdsRef.current.set(id, timeoutId);
    }
  }, [dismissToast]);

  const removeToast = useCallback((id: string) => {
    const timeoutId = timeoutIdsRef.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutIdsRef.current.delete(id);
    }
    setToasts(prev => prev.filter(t => t.id !== id));
    setDismissingIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const contextValue = useMemo(
    () => ({ toasts, dismissingIds, showToast, dismissToast, removeToast }),
    [toasts, dismissingIds, showToast, dismissToast, removeToast]
  );

  return (
    <ToastContext.Provider value={contextValue}>
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
