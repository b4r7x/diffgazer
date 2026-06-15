import { cva } from "class-variance-authority";

/** Size shared by checkbox and radio standalone controls. */
export type SelectableSize = "sm" | "md" | "lg";

/** Indicator style shared by checkbox and radio standalone controls. */
export type SelectableVariant = "x" | "bullet";

/** Text glyphs for checked, unchecked, and indeterminate selectable states. */
export const selectableIndicators = {
  x: { checked: "[x]", unchecked: "[ ]", indeterminate: "[-]" },
  bullet: {
    checked: "[\u00a0\u25cf\u00a0]",
    unchecked: "[\u00a0\u00a0\u00a0]",
    indeterminate: "[ - ]",
  },
} satisfies Record<SelectableVariant, Record<string, string>>;

const selectableHighlightClass =
  "bg-secondary text-foreground font-bold before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-foreground";

/** Root selectable-control variants for highlighted and disabled states. */
export const selectableVariants = cva(
  "group/selectable flex cursor-pointer select-none font-mono relative outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:bg-secondary focus-visible:text-foreground focus-visible:font-bold focus-visible:before:content-[''] focus-visible:before:absolute focus-visible:before:left-0 focus-visible:before:top-0 focus-visible:before:bottom-0 focus-visible:before:w-1 focus-visible:before:bg-foreground",
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
export const selectableIndicatorVariants = cva(
  "font-bold shrink-0 whitespace-nowrap group-focus-visible/selectable:text-foreground",
  {
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
    compoundVariants: [{ checked: true, highlighted: false, className: "text-success" }],
    defaultVariants: {
      size: "md",
      checked: false,
      highlighted: false,
    },
  },
);

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

/** Description text variants for selectable controls. */
export const selectableDescriptionVariants = cva("text-sm mt-0.5", {
  variants: {
    highlighted: {
      true: "text-foreground/70",
      false: "text-muted-foreground group-focus-visible/selectable:text-foreground/70",
    },
  },
  defaultVariants: {
    highlighted: false,
  },
});
