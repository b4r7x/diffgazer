import { cva } from "class-variance-authority";

/** Size shared by checkbox and radio standalone controls. */
export type SelectableSize = "sm" | "md" | "lg";

/** Indicator style shared by checkbox and radio standalone controls. */
export type SelectableVariant = "x" | "bullet";

/** The x-variant glyph pair, identical for both controls. */
const X_INDICATORS = { checked: "[x]", unchecked: "[ ]" } as const;

/** Text glyphs for the two radio states. A radio is never indeterminate. */
export const radioIndicators = {
  x: X_INDICATORS,
  bullet: { checked: "[\u00a0\u25cf\u00a0]", unchecked: "[\u00a0\u00a0\u00a0]" },
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

const selectableHighlightClass =
  "bg-secondary text-foreground font-bold before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-foreground";

/**
 * Root selectable-control variants for highlighted and disabled states.
 * Focus uses the inset field grammar (hairline --ring hugging the control, no
 * offset); the highlight bar stays reserved for collection highlight.
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
  "group/selectable flex cursor-pointer select-none font-mono relative focus:outline-hidden focus:ring-1 focus:ring-ring aria-invalid:ring-1 aria-invalid:ring-error aria-invalid:focus:ring-error",
  {
    variants: {
      highlighted: {
        true: selectableHighlightClass,
        false: "text-foreground hover:bg-secondary/50",
      },
      disabled: {
        true: "opacity-50 cursor-not-allowed",
        false: "",
      },
    },
    defaultVariants: {
      highlighted: false,
      disabled: false,
    },
  },
);

/** Inner layout class for selectable control content. */
export const selectableContainerClass = "flex items-center gap-3 px-3 py-2";

/** Indicator variants for selectable controls. */
export const selectableIndicatorVariants = cva("font-bold shrink-0 whitespace-nowrap", {
  variants: {
    size: {
      sm: "text-sm min-w-[3ch]",
      md: "min-w-[4ch]",
      lg: "text-lg min-w-[4ch]",
    },
    // checked/highlighted carry no standalone classes but must be declared so the
    // typed call sites can pass them and the compound variant below can match.
    checked: {
      true: "",
      false: "",
    },
    highlighted: {
      true: "",
      false: "",
    },
  },
  // The checked glyph is a neutral control accent, not a status: --primary keeps
  // it monochrome in both palettes (status hues stay reserved for meaning).
  compoundVariants: [{ checked: true, highlighted: false, className: "text-primary" }],
  defaultVariants: {
    size: "md",
    checked: false,
    highlighted: false,
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
  },
  defaultVariants: {
    highlighted: false,
  },
});
