"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DialogKeyboardHints, type KeyboardHint } from "./dialog-keyboard-hints";

export { DialogKeyboardHints, type KeyboardHint };

export interface DialogFooterProps extends HTMLAttributes<HTMLDivElement> {
  hints?: KeyboardHint[];
  children?: ReactNode;
}

function DialogFooterRoot({ hints, className, children, ...props }: DialogFooterProps) {
  const hasHints = hints && hints.length > 0;

  return (
    <div
      className={cn(
        "flex gap-3 items-center px-4 pb-4 border-x border-b shrink-0 bg-background text-foreground border-border",
        hasHints ? "justify-between" : "justify-end",
        className
      )}
      {...props}
    >
      {hasHints ? <DialogKeyboardHints hints={hints} /> : null}
      {children ? <DialogFooterActions>{children}</DialogFooterActions> : null}
    </div>
  );
}

export type DialogFooterActionsProps = HTMLAttributes<HTMLDivElement>;

function DialogFooterActions({ className, ...props }: DialogFooterActionsProps) {
  return (
    <div className={cn("flex shrink-0 items-center justify-end gap-3", className)} {...props} />
  );
}

export const DialogFooter: typeof DialogFooterRoot & {
  Hints: typeof DialogKeyboardHints;
  Actions: typeof DialogFooterActions;
} = Object.assign(DialogFooterRoot, {
  Hints: DialogKeyboardHints,
  Actions: DialogFooterActions,
});
