"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useCalloutContext } from "./callout-context";

export interface CalloutDismissProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
}

export function CalloutDismiss({
  children,
  className,
  onClick,
  style,
  ...props
}: CalloutDismissProps) {
  const { onDismiss } = useCalloutContext();

  return (
    <button
      type="button"
      aria-label="Dismiss"
      style={{ gridArea: "dismiss", ...style }}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) onDismiss();
      }}
      className={cn(
        "self-center inline-flex items-center justify-center shrink-0",
        "w-6 h-6 p-1 rounded-[var(--radius)] font-mono text-[13px] cursor-pointer",
        "text-muted hover:text-foreground hover:bg-foreground/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cal-tone)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "transition-colors",
        className,
      )}
      {...props}
    >
      {children ?? "[x]"}
    </button>
  );
}
