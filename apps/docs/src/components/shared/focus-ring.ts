/**
 * The single focus-visible outline recipe for interactive chrome across the
 * docs shell. Every nav link, command trigger, footer link, and panel button
 * shares this so the keyboard focus ring stays one consistent 2px offset outline
 * instead of drifting into per-element variants.
 */
export const FOCUS_RING_CLASS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
