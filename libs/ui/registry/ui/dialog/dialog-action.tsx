"use client";

import type { ReactNode, MouseEventHandler, Ref } from "react";
import { useDialogDismiss } from "./dialog-context";
import { Button, type ButtonProps } from "../button/button";

export interface DialogActionProps
  extends Pick<ButtonProps, "variant" | "size" | "bracket" | "className" | "disabled"> {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  ref?: Ref<HTMLButtonElement>;
  autoFocus?: boolean;
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
