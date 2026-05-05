"use client";

import type { ReactNode, MouseEventHandler, Ref } from "react";
import { useDialogDismiss } from "./dialog-context";
import { Button, type ButtonProps } from "../button/button";

export interface DialogCloseProps
  extends Pick<ButtonProps, "variant" | "size" | "bracket" | "className" | "disabled"> {
  children?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  ref?: Ref<HTMLButtonElement>;
  autoFocus?: boolean;
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
