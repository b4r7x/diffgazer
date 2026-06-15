"use client";

import type { FocusEventHandler, MouseEventHandler, ReactNode, Ref } from "react";
import { Button, type ButtonProps } from "../button/button";
import { useDialogDismiss } from "./dialog-context";

/** Props for dialog action. */
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
  /** Called when focus occurs. */
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
  variant = "action",
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
