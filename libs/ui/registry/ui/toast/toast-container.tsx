"use client";

import type { FocusEvent } from "react";
import { cn } from "@/lib/utils";
import { useToastStore, dismiss, remove, pause, resume, type ToastPosition } from "./toast-store";
import { positionClasses } from "./toast-variants";
import { Toast } from "./toast";
import { useToastContainer } from "./use-toast-container";

function handleBlur(e: FocusEvent<HTMLDivElement>) {
  if (!(e.relatedTarget instanceof Node) || !e.currentTarget.contains(e.relatedTarget)) resume();
}

export interface ToasterProps {
  position?: ToastPosition;
}

export function Toaster({ position = "bottom-right" }: ToasterProps) {
  const { toasts, dismissingIds } = useToastStore();
  useToastContainer(toasts, dismissingIds);
  const hasToasts = toasts.length > 0;

  return (
    <div
      role="region"
      aria-label="Notifications"
      onMouseEnter={hasToasts ? pause : undefined}
      onMouseLeave={hasToasts ? resume : undefined}
      onFocus={hasToasts ? pause : undefined}
      onBlur={hasToasts ? handleBlur : undefined}
      className={cn(
        "fixed z-50 flex gap-2 pointer-events-none",
        position.startsWith("top") ? "flex-col" : "flex-col-reverse",
        positionClasses[position],
      )}
    >
      {toasts.map((t) => (
        <Toast
          key={t.id}
          {...t}
          position={position}
          onDismiss={dismiss}
          onRemove={remove}
          dismissing={dismissingIds.has(t.id)}
        />
      ))}
    </div>
  );
}
