"use client";

import type { HTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";
import { useDialogDismiss } from "./dialog-context";

export interface DialogCloseIconProps
  extends Omit<HTMLAttributes<HTMLButtonElement>, "type" | "children" | "aria-label"> {
  ref?: Ref<HTMLButtonElement>;
  "aria-label"?: string;
}

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
        "absolute top-[var(--dlg-close-btn-inset)] right-[var(--dlg-close-btn-inset)] z-10",
        "inline-flex items-center justify-center w-7 h-7 rounded-sm font-mono text-base leading-none",
        "text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      ×
    </button>
  );
}
