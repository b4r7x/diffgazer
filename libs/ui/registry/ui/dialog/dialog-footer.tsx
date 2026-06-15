"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DialogKeyboardHints, type KeyboardHint } from "./dialog-keyboard-hints";

export { DialogKeyboardHints, type KeyboardHint };

/** Props for dialog footer. */
export interface DialogFooterProps extends ComponentProps<"div"> {
  /**
   * Inline keyboard shortcut hints rendered alongside the action buttons. Use the shorthand
   * instead of composing DialogFooter.Hints when the hints belong with the footer actions.
   */
  hints?: KeyboardHint[];
  /** Content rendered inside the component. */
  children?: ReactNode;
}

function DialogFooterRoot({ hints, className, children, ...props }: DialogFooterProps) {
  const hasHints = hints && hints.length > 0;

  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex gap-3 items-center px-5 pt-3 pb-4 shrink-0 bg-background text-foreground",
        hasHints ? "justify-between" : "justify-end",
        className,
      )}
      {...props}
    >
      {hasHints ? <DialogKeyboardHints hints={hints} /> : null}
      {children ? <DialogFooterActions>{children}</DialogFooterActions> : null}
    </div>
  );
}

/** Props for dialog footer actions. */
export type DialogFooterActionsProps = ComponentProps<"div">;

function DialogFooterActions({ className, ...props }: DialogFooterActionsProps) {
  return (
    <div className={cn("flex shrink-0 items-center justify-end gap-3", className)} {...props} />
  );
}

/** Action buttons and optional keyboard hints. */
export const DialogFooter: typeof DialogFooterRoot & {
  Hints: typeof DialogKeyboardHints;
  Actions: typeof DialogFooterActions;
} = Object.assign(DialogFooterRoot, {
  Hints: DialogKeyboardHints,
  Actions: DialogFooterActions,
});
