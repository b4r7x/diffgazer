import { useEffect, useSyncExternalStore } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../theme/theme-context.js";
import type { Variant } from "../../types/components.js";

interface ToastEntry {
  id: string;
  title: string;
  message?: string;
  variant: Variant;
  duration: number;
}

// --- Toast store ---

let toasts: ToastEntry[] = [];
let listeners: Array<() => void> = [];
let nextId = 0;

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): ToastEntry[] {
  return toasts;
}

function addToast(
  title: string,
  options?: { message?: string; variant?: Variant; duration?: number },
): string {
  const id = String(++nextId);
  const entry: ToastEntry = {
    id,
    title,
    message: options?.message,
    variant: options?.variant ?? "neutral",
    duration: options?.duration ?? 3000,
  };
  toasts = [...toasts, entry];
  emit();
  return id;
}

function dismissToast(id?: string) {
  if (id) {
    toasts = toasts.filter((t) => t.id !== id);
  } else {
    toasts = [];
  }
  emit();
}

// --- Imperative API ---

export function toast(
  title: string,
  options?: { message?: string; variant?: Variant; duration?: number },
): string {
  return addToast(title, options);
}

toast.success = (
  title: string,
  options?: { message?: string; duration?: number },
): string => addToast(title, { ...options, variant: "success" });

toast.error = (
  title: string,
  options?: { message?: string; duration?: number },
): string => addToast(title, { ...options, variant: "error" });

toast.warning = (
  title: string,
  options?: { message?: string; duration?: number },
): string => addToast(title, { ...options, variant: "warning" });

toast.dismiss = dismissToast;

// --- Components ---

const icons: Record<Variant, string> = {
  success: "\u2714",
  error: "\u2716",
  warning: "\u26A0",
  info: "\u2139",
  neutral: "\u2139",
};

function ToastItem({ entry }: { entry: ToastEntry }) {
  const { tokens } = useTheme();

  const colorMap: Record<Variant, string> = {
    success: tokens.success,
    warning: tokens.warning,
    error: tokens.error,
    info: tokens.info,
    neutral: tokens.muted,
  };

  const color = colorMap[entry.variant];
  const icon = icons[entry.variant];

  return (
    <Box flexDirection="column">
      <Text color={color}>
        {icon} {entry.title}
      </Text>
      {entry.message ? (
        <Text color={tokens.muted}>  {entry.message}</Text>
      ) : null}
    </Box>
  );
}

export interface ToasterProps {
  position?: "top" | "bottom";
}

export function Toaster({ position = "bottom" }: ToasterProps) {
  const currentToasts = useSyncExternalStore(subscribe, getSnapshot);

  return (
    <Box
      flexDirection="column"
      marginTop={position === "bottom" ? 1 : 0}
      marginBottom={position === "top" ? 1 : 0}
    >
      {currentToasts.map((entry) => (
        <AutoDismiss key={entry.id} id={entry.id} duration={entry.duration}>
          <ToastItem entry={entry} />
        </AutoDismiss>
      ))}
    </Box>
  );
}

function AutoDismiss({
  id,
  duration,
  children,
}: {
  id: string;
  duration: number;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      dismissToast(id);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration]);

  return <>{children}</>;
}
