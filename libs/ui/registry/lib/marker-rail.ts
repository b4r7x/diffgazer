/**
 * The library's single "you are here" mark.
 *
 * Two states, two marks, everywhere:
 * - SELECTED / CURRENT (persistent) — a 2px left rail in `--primary`. The row
 *   background does not change.
 * - HIGHLIGHTED (transient keyboard/roving focus) — full-bleed inversion.
 * - BOTH — the inverted row plus the rail, flipped to `--primary-foreground` so
 *   it stays visible against the inverted fill.
 *
 * `MARKER_RAIL_BASE` draws the rail transparent in the resting state and pulls
 * the row back by its own width, so the label's x-position is byte-identical
 * whether or not the row is marked. Zero horizontal text shift between states
 * is the acceptance criterion, and it is also why the rail costs 0px of label
 * width at 375/390 where a full-bleed fill reads as a solid slab.
 *
 * Written out in full rather than composed so Tailwind's source scanner sees
 * every candidate.
 */

/** Resting state: reserve the rail so marking a row never shifts its label. */
// Side-scoped on purpose: the all-sides `border-transparent` would let
// tailwind-merge strip any per-side border color merged before this constant
// (an item's own `border-b-border/50` separator included).
export const MARKER_RAIL_BASE = "-ml-[2px] border-l-2 border-l-transparent";

/** Persistent current location, on an un-inverted row. */
export const MARKER_RAIL_SELECTED = "border-l-primary";

/** Persistent current location, on a row that is also inverted by the highlight. */
export const MARKER_RAIL_ON_INVERTED = "border-l-primary-foreground";
