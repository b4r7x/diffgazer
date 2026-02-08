import { createContext, useContext, useRef, useState, type ReactNode } from "react";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration?: number;
  action?: ReactNode;
}

interface ToastDataContextValue {
  toasts: Toast[];
  dismissingIds: Set<string>;
}

interface ToastActionsContextValue {
  showToast: (options: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  removeToast: (id: string) => void;
}

const ToastDataContext = createContext<ToastDataContextValue | undefined>(undefined);
const ToastActionsContext = createContext<ToastActionsContextValue | undefined>(undefined);

const DEFAULT_DURATION = 5000;
const MAX_TOASTS = 5;

export type ToastPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface ToastProviderProps {
  children: ReactNode;
  position?: ToastPosition;
}

export function ToastProvider({ children, position = "bottom-right" }: ToastProviderProps) {
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

  const dismissToast = (id: string) => dismissToastRef.current(id);
  const showToast = (options: Omit<Toast, "id">) => showToastRef.current(options);
  const removeToast = (id: string) => removeToastRef.current(id);

  const dataValue: ToastDataContextValue = { toasts, dismissingIds };
  const actionsValue: ToastActionsContextValue = { showToast, dismissToast, removeToast };

  return (
    <ToastDataContext.Provider value={dataValue}>
      <ToastActionsContext.Provider value={actionsValue}>
        {children}
        <ToastContainerPortal position={position} />
      </ToastActionsContext.Provider>
    </ToastDataContext.Provider>
  );
}

export function useToastData(): ToastDataContextValue {
  const context = useContext(ToastDataContext);
  if (context === undefined) {
    throw new Error("useToastData must be used within a ToastProvider");
  }
  return context;
}

export function useToastActions(): ToastActionsContextValue {
  const context = useContext(ToastActionsContext);
  if (context === undefined) {
    throw new Error("useToastActions must be used within a ToastProvider");
  }
  return context;
}

// Backward-compatible hook. Prefer useToastData() and useToastActions() to
// avoid unnecessary re-renders — most consumers only need actions.
export function useToast(): ToastDataContextValue & ToastActionsContextValue {
  return { ...useToastData(), ...useToastActions() };
}

// Lazy import to avoid circular deps — ToastContainer uses context hooks
import { ToastContainerPortal } from "./toast-container";
