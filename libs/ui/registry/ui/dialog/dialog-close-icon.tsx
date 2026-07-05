"use client";

import type { ComponentProps, Ref } from "react";
import { cn } from "@/lib/utils";
import { useDialogDismiss } from "./dialog-context";

/** Props for dialog close icon. */
export interface DialogCloseIconProps
  extends Omit<ComponentProps<"button">, "type" | "children" | "aria-label" | "ref"> {
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLButtonElement>;
  /** Accessible name for the close button. Override for localization or alternative phrasing. */
  "aria-label"?: string;
}

/**
 * Optional top-right close button - render LAST inside DialogContent so DOM/Tab order is
 * correct (it absolute-positions itself)
 */
export function DialogCloseIcon({
  ref,
  className,
  onClick,
  "aria-label": ariaLabel = "Close dialog",
  ...props
}: DialogCloseIconProps) {
  const handleClick = useDialogDismiss<HTMLButtonElement>(onClick);

  return (
    <button
      ref={ref}
      type="button"
      data-slot="dialog-close-icon"
      aria-label={ariaLabel}
      className={cn(
        "absolute top-[var(--dialog-close-btn-inset)] right-[var(--dialog-close-btn-inset)] z-10",
        "inline-flex items-center justify-center w-7 h-7 rounded-sm font-mono text-base leading-none",
        "text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
        "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      ×
    </button>
  );
}
