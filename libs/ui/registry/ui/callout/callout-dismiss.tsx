"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useCalloutContext } from "./callout-context";

/** Props for callout dismiss. */
export interface CalloutDismissProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Custom dismiss button content. */
  children?: ReactNode;
}

/** Close button (24×24 with 4px padding) */
export function CalloutDismiss({ children, className, onClick, ...props }: CalloutDismissProps) {
  const { onDismiss } = useCalloutContext();

  return (
    <button
      type="button"
      data-slot="callout-dismiss"
      aria-label={children ? undefined : "Dismiss"}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) onDismiss();
      }}
      className={cn(
        "self-center inline-flex items-center justify-center shrink-0",
        "w-6 h-6 p-1 rounded-[var(--radius)] font-mono text-[13px] cursor-pointer",
        "text-muted hover:text-foreground hover:bg-foreground/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--callout-tone,var(--foreground))] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "transition-colors",
        className,
      )}
      {...props}
    >
      {children ?? "[x]"}
    </button>
  );
}
