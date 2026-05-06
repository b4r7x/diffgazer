"use client";

import { cn } from "@/lib/utils";
import { Spinner } from "../spinner/spinner";
import type { Toast as ToastType, ToastPosition } from "./toast-store";
import { toastVariants, iconColors, icons, slideAnimations, positionToSide } from "./toast-variants";
import { useToastDismiss } from "./use-toast-dismiss";

interface ToastProps extends ToastType {
  position: ToastPosition;
  onDismiss: (id: string) => void;
  onRemove: (id: string) => void;
  dismissing?: boolean;
}

export function Toast({
  id,
  variant = "info",
  title,
  message,
  action,
  position,
  onDismiss,
  onRemove,
  dismissing,
}: ToastProps) {
  const { onAnimationEnd } = useToastDismiss(dismissing ?? false, id, onRemove);
  const animation = slideAnimations[positionToSide[position]][dismissing ? "out" : "in"];
  const isError = variant === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
      className={cn("pointer-events-auto", toastVariants({ variant }), animation)}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-secondary/40">
        <div className="flex items-center gap-2">
          <span className={cn("font-bold", iconColors[variant])} aria-hidden="true">
            {variant === "loading" ? <Spinner variant="braille" size="sm" gap="none" aria-hidden="true" /> : icons[variant]}
          </span>
          <span className="sr-only">{variant}:</span>
          <span className="text-xs font-bold uppercase tracking-tight text-foreground">
            {title}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(id)}
          className="p-1 min-h-6 min-w-6 flex items-center justify-center text-xs leading-none text-muted hover:text-foreground"
          aria-label={`Dismiss: ${title}`}
        >
          ✕
        </button>
      </div>
      {(message || action) && (
        <div className="p-3 text-sm flex items-center justify-between gap-2">
          {message && <span className="text-foreground/90">{message}</span>}
          {action && <span className="shrink-0">{action}</span>}
        </div>
      )}
    </div>
  );
}
