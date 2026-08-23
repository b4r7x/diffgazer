"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type CalloutTone, useCalloutContext } from "./callout-context";

// Character glyphs, matching Toast's tone icons — one terminal-grade icon
// language across the feedback family. SVGs remain available via children.
const DEFAULT_ICON: Record<CalloutTone, ReactNode> = {
  info: "i",
  warning: "!",
  error: "✕",
  success: "✓",
};

export interface CalloutIconProps extends ComponentProps<"span"> {
  /** Custom icon content (character, emoji, or SVG). The icon is decorative and aria-hidden. */
  children?: ReactNode;
}

/** Tone icon - character glyph in the tone color (overridable via children) */
export function CalloutIcon({ children, className, ...props }: CalloutIconProps) {
  const { tone } = useCalloutContext();

  return (
    <span
      aria-hidden="true"
      data-slot="callout-icon"
      className={cn(
        "inline-flex items-center justify-center self-center w-4 h-4 font-bold leading-none text-[color:var(--callout-tone,var(--foreground))] [&>svg]:w-[14px] [&>svg]:h-[14px]",
        className,
      )}
      {...props}
    >
      {children ?? DEFAULT_ICON[tone]}
    </span>
  );
}
