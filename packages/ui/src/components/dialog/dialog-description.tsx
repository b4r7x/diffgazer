import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { useDialogContext } from "./dialog-context";

export interface DialogDescriptionProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function DialogDescription({ children, className, ...props }: DialogDescriptionProps) {
  const { descriptionId } = useDialogContext();

  return (
    <div
      id={descriptionId}
      className={cn("text-xs text-tui-fg/70", className)}
      {...props}
    >
      {children}
    </div>
  );
}
