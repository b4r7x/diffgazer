"use client";

import type { FocusEventHandler, MouseEventHandler, ReactNode, Ref } from "react";
import { Button, type ButtonProps } from "../button/button";
import { useDialogDismiss } from "./dialog-context";

export interface DialogActionProps
  extends Pick<
    ButtonProps,
    "variant" | "size" | "bracket" | "className" | "disabled" | "loading" | "highlighted"
  > {
  /** Content rendered inside the component. */
  children: ReactNode;
  /**
   * Primary action handler. Call e.preventDefault() to keep the dialog open (e.g. failed form
   * validation).
   */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** Forwarded to the underlying button; the dialog adds no focus handling of its own. */
  onFocus?: FocusEventHandler<HTMLButtonElement>;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLButtonElement>;
  /** Moves focus to the element when it mounts. */
  autoFocus?: boolean;
  [dataAttribute: `data-${string}`]: unknown;
}

/** Primary action button (closes unless prevented) */
export function DialogAction({
  children,
  onClick,
  // "primary" is the single primary-CTA voice: it renders the --action pair in
  // both themes, so a dialog's confirming action never drifts per theme.
  variant = "primary",
  bracket = true,
  ref,
  ...props
}: DialogActionProps) {
  const handleClick = useDialogDismiss(onClick);

  return (
    <Button
      ref={ref}
      type="button"
      {...props}
      variant={variant}
      bracket={bracket}
      onClick={handleClick}
    >
      {children}
    </Button>
  );
}
