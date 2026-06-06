"use client";

import type { FocusEventHandler, MouseEventHandler, ReactNode, Ref } from "react";
import { Button, type ButtonProps } from "../button/button";
import { useDialogDismiss } from "./dialog-context";

export interface DialogCloseProps
  extends Pick<ButtonProps, "variant" | "size" | "bracket" | "className" | "disabled" | "highlighted"> {
  children?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  onFocus?: FocusEventHandler<HTMLButtonElement>;
  ref?: Ref<HTMLButtonElement>;
  autoFocus?: boolean;
  [dataAttribute: `data-${string}`]: unknown;
}

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
