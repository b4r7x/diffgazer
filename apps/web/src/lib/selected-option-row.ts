/**
 * Selected option row for radio lists app-wide (model rows, API-key method rows, theme selector
 * rows): a raised fill, a 3px accent bar down the left edge, and an accent glyph. No resting
 * outline — the hairline --ring from selectable-variants stays reserved for keyboard focus, so
 * fill and outline never paint at the same time. Keyed off the aria-checked the radio row
 * already exposes.
 *
 * Precedence: highlight > checked. Every utility is gated on not-data-highlighted so that when
 * the collection highlight sits on the checked row, the highlight treatment from
 * selectable-variants (bg-secondary fill, 4px foreground bar, bold foreground text and glyph)
 * wins intact; this marking only paints on checked rows the highlight is not on.
 *
 * The glyph is the row's only direct <span> child; the label sits beside it.
 *
 * One constant because it is one locked visual contract: tuning it at a single call site would
 * otherwise drift the other radio lists off the same recipe.
 */
export const SELECTED_OPTION_ROW =
  "aria-checked:not-data-highlighted:bg-[var(--surface-1)] aria-checked:not-data-highlighted:before:absolute aria-checked:not-data-highlighted:before:inset-y-0 aria-checked:not-data-highlighted:before:left-0 aria-checked:not-data-highlighted:before:w-[3px] aria-checked:not-data-highlighted:before:bg-primary aria-checked:not-data-highlighted:before:content-[''] aria-checked:not-data-highlighted:[&>span]:text-primary";
