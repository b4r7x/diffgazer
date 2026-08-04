"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DialogKeyboardHints, type KeyboardHint } from "./dialog-keyboard-hints";

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
        // No background of its own: the footer inherits the dialog's --surface-1 fill so the
        // action row never reads as a second-tone strip under the body.
        "flex flex-wrap gap-3 items-center px-5 pt-3 pb-4 shrink-0",
        // corners="bold" draws 28px bracket arms; the footer insets past them so
        // an action button corner never collides with the bottom brackets.
        "[[data-corners=bold]_&]:px-8 [[data-corners=bold]_&]:pb-6",
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
    <div
      data-slot="dialog-footer-actions"
      className={cn(
        "flex min-w-0 max-w-full basis-full flex-col items-stretch justify-end gap-3 sm:basis-auto sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
      {...props}
    />
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
