import type { ReactNode, MouseEventHandler } from "react";
import { useDialogContext } from "./dialog-context";

export interface DialogCloseProps {
  children?: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

export function DialogClose({ children, className, onClick }: DialogCloseProps) {
  const { onOpenChange } = useDialogContext();

  const isDefault = !children;

  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        onOpenChange(false);
        onClick?.(e);
      }}
      {...(isDefault && { "aria-label": "Close dialog" })}
    >
      {children || "[x]"}
    </button>
  );
}
