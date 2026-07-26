/**
 * The single uppercase chrome-label recipe for the docs TUI shell. Every
 * status-bar/footer/panel-header microcopy label uses this so the typographic
 * step (text-2xs) and tracking (widest) stay consistent across the chrome
 * instead of drifting into competing one-off tracking values.
 * Below md the label steps up a type size for mobile legibility; md+ keeps the
 * terminal density.
 */
export const CHROME_LABEL_CLASS =
  "font-mono text-xs uppercase tracking-widest text-muted-foreground md:text-2xs";

/** Hit-area recipe for first-order chrome navigation links (24px floor, 44px on touch). */
export const CHROME_NAV_TARGET_CLASS = "flex min-h-6 items-center pointer-coarse:min-h-11";

/** Hit-area recipe for secondary chrome actions (toggle, search, footer links). */
export const CHROME_ACTION_TARGET_CLASS = "inline-flex min-h-6 items-center pointer-coarse:min-h-9";
