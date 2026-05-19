"use client";

import type { ReactNode, MouseEventHandler, FocusEventHandler, Ref } from "react";
import { useDialogDismiss } from "./dialog-context";
import { Button, type ButtonProps } from "../button/button";

export interface DialogCloseProps
  extends Pick<ButtonProps, "variant" | "size" | "bracket" | "className" | "disabled" | "highlighted"> {
  children?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  onFocus?: FocusEventHandler<HTMLButtonElement>;
  ref?: Ref<HTMLButtonElement>;
  autoFocus?: boolean;
  [dataAttribute: `data-${string}`]: unknown;
}

/**
 * Inline close button intended for the dialog footer. Renders the shared
 * `Button` primitive in `ghost` variant so it composes with `DialogFooter`
 * action rows. For the top-right `×` glyph instead, use {@link DialogCloseIcon}.
 *
 * Calls `onClick`, then dismisses the dialog unless the consumer calls
 * `e.preventDefault()` (e.g. to keep the dialog open during async validation).
 */
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
