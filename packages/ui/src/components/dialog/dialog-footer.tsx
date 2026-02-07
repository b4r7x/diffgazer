import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface DialogFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function DialogFooter({ children, className, ...props }: DialogFooterProps) {
  return (
    <div
      className={cn(
        "flex gap-2 justify-end items-center py-2 px-4 border-t-2 border-tui-border bg-tui-bg shrink-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
