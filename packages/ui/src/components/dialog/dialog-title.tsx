import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { useDialogContext } from "./dialog-context";

export interface DialogTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

export function DialogTitle({ children, className, ...props }: DialogTitleProps) {
  const { titleId } = useDialogContext();

  return (
    <h2 id={titleId} className={cn("font-bold text-sm", className)} {...props}>
      {children}
    </h2>
  );
}
