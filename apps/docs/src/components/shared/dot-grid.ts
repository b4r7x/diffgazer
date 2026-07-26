/**
 * The shared dot-grid backdrop for theme preview surfaces. The dot is a
 * translucent foreground tint, so it follows the active theme and re-tints when
 * the playground edits the palette; foreground and background are always a
 * contrasting pair, so 20% stays legible in both themes (~1.5-1.6:1).
 *
 * `color-mix(in_oklab, var(--foreground) N%, ...)` is the repo's tinted-surface
 * recipe (see the card variants).
 */
export const DOT_GRID_CLASS =
  "bg-[radial-gradient(color-mix(in_oklab,var(--foreground)_20%,transparent)_1px,transparent_1px)] [background-size:20px_20px]";
