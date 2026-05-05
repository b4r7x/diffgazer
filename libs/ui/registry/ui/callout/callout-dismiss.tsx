"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useCalloutContext } from "./callout-context";

export interface CalloutDismissProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
}

export function CalloutDismiss({ children, className, onClick, ...props }: CalloutDismissProps) {
  const { onDismiss } = useCalloutContext();

  return (
    <button
      type="button"
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) onDismiss();
      }}
      className={cn(
        "col-start-3 row-start-1 shrink-0 font-mono text-sm min-h-[44px] min-w-[44px] flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity cursor-pointer focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      aria-label="Dismiss"
      {...props}
    >
      {children ?? "[x]"}
    </button>
  );
}