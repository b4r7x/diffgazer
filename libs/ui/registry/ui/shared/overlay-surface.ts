/**
 * The overlay family runs ONE elevation grammar, in two tiers.
 *
 * Both tiers share the same fill: `--surface-1` is one step off the page
 * background (lighter in dark, darker in light) with a 1px
 * `--surface-1-highlight` inner lip that keeps the step reading as raised. Depth
 * is a drawn edge plus a surface step — never a blur.
 *
 * ANCHORED (Popover, Tooltip, Select.Content, Menu.SubContent, Select `card`):
 * fill + hairline + lip. No drop shadow — an anchored surface is a small step
 * off its trigger, not a slab.
 *
 * MODAL (Dialog, CommandPalette): the same fill and lip plus `--shadow-hard`,
 * the library's only sanctioned drop shadow, composited into the same box-shadow
 * so the lip and the slab cannot overwrite one another. The hairline is
 * deliberately NOT baked in: both modal surfaces own a `frame` axis
 * (`dialogContentVariants`, `[data-frame]` in command-palette.css) that decides
 * whether an edge is drawn.
 *
 * The class strings are written out in full rather than composed, so Tailwind's
 * source scanner can see every candidate.
 */

/** Anchored overlay tier: rounded hairline box with the shared surface step. */
export const OVERLAY_SURFACE =
  "rounded-sm border border-border bg-[color:var(--surface-1)] shadow-[inset_0_1px_0_var(--surface-1-highlight)]";

/** Modal overlay tier: the shared surface step plus the hard offset slab. */
export const OVERLAY_SURFACE_MODAL =
  "rounded-sm bg-[color:var(--surface-1)] shadow-[inset_0_1px_0_var(--surface-1-highlight),var(--shadow-hard)]";
