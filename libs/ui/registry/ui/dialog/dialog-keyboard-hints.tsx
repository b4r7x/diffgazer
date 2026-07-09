"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Kbd } from "../kbd/kbd";

/**
 * Modal dialog with compound component architecture. Built on the native dialog element with
 * two orthogonal visual axes: frame (border or none) and corners (none, subtle, standard, bold,
 * or outset), and an optional header marker bar spanning the title and description.
 */
export interface KeyboardHint {
  key: string;
  /** Accessible label text. */
  label: string;
}

/** Props for dialog keyboard hints. */
export interface DialogKeyboardHintsProps extends ComponentProps<"div"> {
  hints: KeyboardHint[];
  /** Size variant. */
  size?: "sm" | "md";
}

/**
 * Modal dialog with compound component architecture. Built on the native dialog element with
 * two orthogonal visual axes: frame (border or none) and corners (none, subtle, standard, bold,
 * or outset), and an optional header marker bar spanning the title and description.
 */
export function DialogKeyboardHints({
  hints,
  size = "md",
  className,
  ...props
}: DialogKeyboardHintsProps) {
  if (!hints.length) return null;

  return (
    <div
      className={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs", className)}
      {...props}
    >
      {hints.map((hint) => (
        <span key={`${hint.key}-${hint.label}`} className="inline-flex items-center gap-1">
          {/* Key name stays exposed to AT (no aria-hidden) so keyboard users can
              discover the shortcut — CommandPaletteInput's Kbd is the model. */}
          <Kbd size={size}>{hint.key}</Kbd>
          <span>{hint.label}</span>
        </span>
      ))}
    </div>
  );
}
