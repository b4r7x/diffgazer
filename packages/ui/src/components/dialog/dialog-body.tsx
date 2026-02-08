import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface DialogBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function DialogBody({ children, className, ...props }: DialogBodyProps) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto px-4 py-3", className)}
      {...props}
    >
      {children}
    </div>
  );
}
