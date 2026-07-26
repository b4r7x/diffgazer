"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Kbd } from "../kbd/kbd";

/** Props for overlay hints item. */
export interface OverlayHintsItemProps extends Omit<ComponentProps<"span">, "children"> {
  /** Key names rendered as Kbd chips, in press order. */
  keys: string[];
  /**
   * Marks the hint as useful without a keyboard. Unmarked items are hidden at
   * coarse pointer, and a bar where nothing survives collapses entirely.
   */
  touch?: boolean;
  /** What the keys do. */
  children: ReactNode;
  /** Size of the rendered Kbd chips. */
  size?: "sm" | "md";
}

/** One key group plus its label. */
function OverlayHintsItem({
  keys,
  touch = false,
  size = "md",
  children,
  className,
  ...rest
}: OverlayHintsItemProps) {
  return (
    <span
      {...rest}
      data-slot="overlay-hints-item"
      data-touch={touch ? "" : undefined}
      className={className}
    >
      {keys.map((key) => (
        <Kbd key={key} size={size}>
          {key}
        </Kbd>
      ))}
      <span>{children}</span>
    </span>
  );
}

/** Props for overlay hints. */
export interface OverlayHintsProps extends ComponentProps<"div"> {
  /** OverlayHints.Item children. */
  children: ReactNode;
}

/**
 * Keyed legend for a keyboard surface — the one piece of chrome that says the
 * product is keyboard-first, so every overlay spells it the same way.
 *
 * Hidden from assistive technology by default: the shortcuts are already
 * reachable through the real controls and their `aria-keyshortcuts`, and
 * announcing "↑ ↓ Navigate" inside a listbox is noise. Pass
 * `aria-hidden={false}` when the key names should be discoverable by AT.
 */
export function OverlayHintsRoot({
  children,
  className,
  "aria-hidden": ariaHidden = true,
  ...rest
}: OverlayHintsProps) {
  return (
    <div
      {...rest}
      aria-hidden={ariaHidden}
      data-slot="overlay-hints"
      className={cn("text-xs", className)}
    >
      {children}
    </div>
  );
}

export const OverlayHints = Object.assign(OverlayHintsRoot, { Item: OverlayHintsItem });
