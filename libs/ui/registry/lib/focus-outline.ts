/**
 * The library's single keyboard-focus mark.
 *
 * One grammar, one token: a 2px `--ring` outline hugging the control edge, so
 * focus recolors the control's frame instead of floating a halo around it.
 *
 * Scope: controls — buttons, rows, scroll regions, triggers. Fields do not use
 * it: inputs and the div-based selectable controls keep the inset field grammar
 * (`focus:border-ring` plus `focus:ring-1`), which recolors the border a field
 * already has instead of adding a second frame. See `input-variants` and
 * `selectable-variants`.
 *
 * - `FOCUS_OUTLINE` — real keyboard focus, drawn just outside the border box.
 * - `FOCUS_OUTLINE_INSET` — the same mark pulled inside the box for surfaces
 *   whose outside edge an enclosing scroller would clip.
 * - `HIGHLIGHT_OUTLINE` — the same mark minus `focus-visible`, for virtual
 *   focus handed down by a parent collection.
 *
 * Written out in full rather than composed so Tailwind's source scanner sees
 * every candidate.
 */

/** Real keyboard focus: a 2px --ring outline hugging the control edge. */
export const FOCUS_OUTLINE =
  "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-0";

/** Keyboard focus on a clipped surface: the same mark drawn inside the box. */
export const FOCUS_OUTLINE_INSET =
  "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]";

/** Virtual focus from a parent collection: the same mark without focus-visible. */
export const HIGHLIGHT_OUTLINE = "outline-2 outline-ring outline-offset-0";
