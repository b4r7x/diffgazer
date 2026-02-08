import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface DialogHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function DialogHeader({ children, className, ...props }: DialogHeaderProps) {
  return (
    <div
      className={cn(
        "flex justify-between items-center py-2 px-4 border-b-2 border-tui-border bg-tui-bg shrink-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
