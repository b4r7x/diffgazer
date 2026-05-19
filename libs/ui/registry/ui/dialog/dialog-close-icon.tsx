"use client";

import type { HTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";
import { useDialogDismiss } from "./dialog-context";

export interface DialogCloseIconProps
  extends Omit<HTMLAttributes<HTMLButtonElement>, "type" | "children" | "aria-label"> {
  ref?: Ref<HTMLButtonElement>;
  /** Defaults to "Close dialog". */
  "aria-label"?: string;
}

/**
 * Top-right close button for {@link DialogContent}. Opt-in compound primitive —
 * render `<Dialog.CloseIcon />` anywhere inside `Dialog.Content`. Position it as
 * the LAST child of `Dialog.Content` so it comes last in DOM (and Tab) order;
 * it absolute-positions itself to the top-right corner regardless of placement.
 *
 * Distinct from `Dialog.Close`, which is the inline button intended for footer
 * use. This primitive renders the bare TUI-style `×` glyph and is not coupled
 * to the `Button` variant system, so copy-mode consumers do not need the
 * `Button` source to use it.
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
