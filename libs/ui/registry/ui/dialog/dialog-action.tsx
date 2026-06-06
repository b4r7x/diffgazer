"use client";

import type { FocusEventHandler, MouseEventHandler, ReactNode, Ref } from "react";
import { Button, type ButtonProps } from "../button/button";
import { useDialogDismiss } from "./dialog-context";

export interface DialogActionProps
  extends Pick<ButtonProps, "variant" | "size" | "bracket" | "className" | "disabled" | "loading" | "highlighted"> {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  onFocus?: FocusEventHandler<HTMLButtonElement>;
  ref?: Ref<HTMLButtonElement>;
  autoFocus?: boolean;
  [dataAttribute: `data-${string}`]: unknown;
}

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
    <Button ref={ref} type="button" {...props} variant={variant} bracket={bracket} onClick={handleClick}>
      {children}
    </Button>
  );
}
