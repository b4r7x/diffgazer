import { cva } from "class-variance-authority";
import { MARKER_RAIL_BASE, MARKER_RAIL_SELECTED } from "@/lib/marker-rail";

/** Size shared by checkbox and radio standalone controls. */
export type SelectableSize = "sm" | "md" | "lg";

/** Indicator style shared by checkbox and radio standalone controls. */
export type SelectableVariant = "x" | "bullet";

/** The x-variant glyph pair, identical for both controls. */
const X_INDICATORS = { checked: "[x]", unchecked: "[ ]" } as const;

/**
 * Text glyphs for the two radio states. A radio is never indeterminate.
 *
 * Three characters, like every other glyph in the family: a wider glyph overruns the reserved
 * cell and shifts radio labels off the checkbox column.
 */
export const radioIndicators = {
  x: X_INDICATORS,
  bullet: { checked: "[\u25cf]", unchecked: "[ ]" },
} satisfies Record<SelectableVariant, Record<string, string>>;

/**
 * Checkbox glyphs. The bullet variant marks the checked state with an asterisk
 * instead of the radio dot so a checkbox never reads as a radio, and keeps the
 * three-character width of the x variant so both variants align in one column.
 */
export const checkboxIndicators = {
  x: { ...X_INDICATORS, indeterminate: "[-]" },
  bullet: { checked: "[*]", unchecked: "[ ]", indeterminate: "[-]" },
} satisfies Record<SelectableVariant, Record<string, string>>;

const selectableHighlightClass = `bg-secondary text-foreground font-bold ${MARKER_RAIL_SELECTED}`;

/**
 * Root selectable-control variants for highlighted and disabled states.
 * Focus uses the inset field grammar (hairline --ring hugging the control, no
 * offset); the marker rail stays reserved for collection highlight.
 *
 * `focus:` rather than `focus-visible:` is deliberate: these are fields, and a field shows
 * its focus state however focus arrived. The accepted consequence is that clicking the
 * div-based control leaves the ring on, the same as clicking into a text input does.
 *
 * `outline-hidden` rather than `outline-none` for the reason spelled out in
 * input-variants.ts: forced-colors drops the ring, so the suppressed outline has to come
 * back as the transparent one forced-colors repaints.
 */
export const selectableVariants = cva(
  `group/selectable flex cursor-pointer select-none font-mono relative ${MARKER_RAIL_BASE} focus:outline-hidden focus:ring-1 focus:ring-ring aria-invalid:ring-1 aria-invalid:ring-error aria-invalid:focus:ring-error`,
  {
    variants: {
      highlighted: {
        true: selectableHighlightClass,
        false: "text-foreground hover:bg-secondary/50",
      },
      // Disabled resolves a token instead of fading the row. `opacity-50` multiplied whatever
      // tone the row already had (3.18:1 in light, 4.48:1 in dark — straddling the 4.5:1 line)
      // and forced-colors mode ignores opacity entirely, so disabled was invisible there;
      // `--muted-foreground` clears 4.5:1 in both palettes and GrayText carries high contrast.
      disabled: {
        true: "cursor-not-allowed text-muted-foreground forced-colors:text-[GrayText]",
        false: "",
      },
    },
    defaultVariants: {
      highlighted: false,
      disabled: false,
    },
  },
);

/**
 * Inner layout class for selectable control content. The row keeps its
 * pointer:fine density (36px) and grows to a 44px touch target on coarse
 * pointers; the row container flows freely, so this is a real height bump.
 */
export const selectableContainerClass = "flex items-center gap-3 px-3 py-2 pointer-coarse:min-h-11";

/**
 * Indicator variants for selectable controls.
 *
 * Every glyph in the family is exactly three characters, so the reserved cell is `3ch` at every
 * size. The font-size still scales the cell in pixels, but never in characters — which is what
 * keeps one label left edge in a form that mixes checkboxes and radios. The gap to the label is
 * owned by the row's `gap-3`, so this reservation has one job.
 */
export const selectableIndicatorVariants = cva("font-bold shrink-0 whitespace-nowrap min-w-[3ch]", {
  variants: {
    size: {
      sm: "text-sm",
      md: "",
      lg: "text-lg",
    },
    // highlighted carries no standalone classes but must be declared so the typed call sites
    // can pass it.
    highlighted: {
      true: "",
      false: "",
    },
    // A disabled glyph reads as structure rather than as content: --border-strong is the same
    // token the numbered stepper square and its connector use.
    disabled: {
      true: "text-border-strong forced-colors:text-[GrayText]",
      false: "",
    },
  },
  // No `checked` tone lives here. `--primary` resolves to `--base-fg` in dark and light
  // `--base-highlight` is light `--base-fg`, so the old `checked → text-primary` compound painted
  // the mark in exactly the label's color in both palettes. The checked/unchecked distinction is
  // carried by the glyph split in `selectable-glyph.tsx` instead: dim brackets, bold mark.
  defaultVariants: {
    size: "md",
    highlighted: false,
    disabled: false,
  },
});

/** Label text variants for selectable controls. */
export const selectableLabelVariants = cva("", {
  variants: {
    size: {
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

/**
 * Visible group-label variants for selectable groups. Invalid groups tint the label
 * with the error hue so the requirement is legible without a separate error row.
 */
export const selectableGroupLabelVariants = cva("font-mono font-bold", {
  variants: {
    invalid: {
      true: "text-error",
      false: "text-muted-foreground",
    },
    size: {
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
    },
  },
  defaultVariants: {
    invalid: false,
    size: "md",
  },
});

/** Description text variants for selectable controls. */
export const selectableDescriptionVariants = cva("text-sm mt-0.5", {
  variants: {
    highlighted: {
      true: "text-foreground/70",
      false: "text-muted-foreground group-focus/selectable:text-foreground/70",
    },
    // The description was already --muted-foreground, so the old opacity fade compounded on it.
    // Disabled keeps the tone and only adds the forced-colors mark.
    disabled: {
      true: "text-muted-foreground forced-colors:text-[GrayText]",
      false: "",
    },
  },
  defaultVariants: {
    highlighted: false,
    disabled: false,
  },
});
