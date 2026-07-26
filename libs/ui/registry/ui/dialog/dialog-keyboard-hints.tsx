"use client";

import type { ComponentProps } from "react";
import { OverlayHints } from "../shared/overlay-hints";

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
 * Dialog's slice of the shared overlay hint legend. Key names stay exposed to
 * AT (`aria-hidden={false}`) so keyboard users can discover the shortcut — that
 * is Dialog's long-standing behaviour and the reason it opts out of the
 * primitive's default.
 */
export function DialogKeyboardHints({
  hints,
  size = "md",
  className,
  ...props
}: DialogKeyboardHintsProps) {
  if (!hints.length) return null;

  return (
    <OverlayHints aria-hidden={false} className={className} {...props}>
      {hints.map((hint) => (
        <OverlayHints.Item key={`${hint.key}-${hint.label}`} keys={[hint.key]} size={size}>
          {hint.label}
        </OverlayHints.Item>
      ))}
    </OverlayHints>
  );
}
