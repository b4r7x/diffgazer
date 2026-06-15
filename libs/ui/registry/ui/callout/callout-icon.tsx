"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type CalloutTone, useCalloutContext } from "./callout-context";

const DEFAULT_ICON: Record<CalloutTone, ReactNode> = {
  info: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="8" cy="8" r="7" />
      <path d="M8 5v4M8 11h.01" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M8 1.5L15 14H1L8 1.5z" />
      <path d="M8 6v4M8 12h.01" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="8" cy="8" r="7" />
      <path d="M5 5l6 6M11 5l-6 6" />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="8" cy="8" r="7" />
      <path d="M5 8.5l2 2 4-5" />
    </svg>
  ),
};

/** Props for callout icon. */
export interface CalloutIconProps extends ComponentProps<"span"> {
  /** Custom icon content. The icon is decorative and aria-hidden. */
  children?: ReactNode;
}

/** Tone icon - outlined 14px SVG (overridable via children) */
export function CalloutIcon({ children, className, ...props }: CalloutIconProps) {
  const { tone } = useCalloutContext();

  return (
    <span
      aria-hidden="true"
      data-slot="callout-icon"
      className={cn(
        "inline-flex items-center justify-center self-center w-4 h-4 text-[color:var(--callout-tone,var(--foreground))] [&>svg]:w-[14px] [&>svg]:h-[14px]",
        className,
      )}
      {...props}
    >
      {children ?? DEFAULT_ICON[tone]}
    </span>
  );
}
