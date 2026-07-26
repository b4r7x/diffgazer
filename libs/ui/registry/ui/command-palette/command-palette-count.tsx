"use client";

import type { Ref } from "react";
import { useCommandPaletteContext } from "./command-palette-context";

/** Props for command palette count. */
export interface CommandPaletteCountProps {
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLSpanElement>;
}

/**
 * Bracketed position readout for the filtered list — `[3/24]` when a row is
 * highlighted, `[24]` when none is, `[0]` when the filter matched nothing.
 *
 * The palette already computes this for its live region; without the readout a
 * sighted keyboard user cannot tell whether the filter matched six rows or sixty
 * without scrolling. It is `aria-hidden` on purpose: the polite live region owns
 * the announcement, so screen-reader users hear it once, not twice.
 */
export function CommandPaletteCount({ className, ref }: CommandPaletteCountProps) {
  const { itemCount, highlightedPosition } = useCommandPaletteContext();
  const isEmpty = itemCount === 0;
  const position = !isEmpty && highlightedPosition !== null ? `${highlightedPosition}/` : "";

  return (
    <span
      ref={ref}
      data-slot="command-palette-count"
      data-empty={isEmpty ? "" : undefined}
      aria-hidden="true"
      className={className}
    >
      [{position}
      {itemCount}]
    </span>
  );
}
