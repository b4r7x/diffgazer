"use client";

import type { FocusEventHandler, MouseEventHandler, ReactNode, Ref } from "react";
import { Button, type ButtonProps } from "../button/button";
import { useDialogDismiss } from "./dialog-context";

/** Props for dialog close. */
export interface DialogCloseProps
  extends Pick<
    ButtonProps,
    "variant" | "size" | "bracket" | "className" | "disabled" | "highlighted"
  > {
  /** Content rendered inside the component. */
  children?: ReactNode;
  /** Close handler. Call e.preventDefault() to keep the dialog open. */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** Called when focus occurs. */
  onFocus?: FocusEventHandler<HTMLButtonElement>;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLButtonElement>;
  /** Moves focus to the element when it mounts. */
  autoFocus?: boolean;
  [dataAttribute: `data-${string}`]: unknown;
}

/** Close button. */
export function DialogClose({
  children,
  onClick,
  variant = "ghost",
  ref,
  ...buttonProps
}: DialogCloseProps) {
  const handleClick = useDialogDismiss(onClick);

  return (
    <Button
      ref={ref}
      type="button"
      {...buttonProps}
      variant={variant}
      aria-label={!children ? "Close dialog" : undefined}
      onClick={handleClick}
    >
      {children ?? "[x]"}
    </Button>
  );
}
