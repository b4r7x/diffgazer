import { cva } from "class-variance-authority";

export type SelectableSize = "sm" | "md" | "lg";

export type SelectableVariant = "x" | "bullet";

export const selectableIndicators = {
  x: { checked: "[x]", unchecked: "[ ]", indeterminate: "[-]" },
  bullet: { checked: "[\u00a0\u25cf\u00a0]", unchecked: "[\u00a0\u00a0\u00a0]", indeterminate: "[ - ]" },
} satisfies Record<SelectableVariant, Record<string, string>>;

export const selectableVariants = cva(
  "flex cursor-pointer select-none font-mono relative",
  {
    variants: {
      highlighted: {
        true: "bg-secondary text-foreground font-bold before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-foreground",
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
  }
);

export const selectableContainerClass = "flex items-center gap-3 px-3 py-2";

export const selectableIndicatorVariants = cva("font-bold shrink-0 whitespace-nowrap", {
  variants: {
    size: {
      sm: "text-sm min-w-[3ch]",
      md: "min-w-[4ch]",
      lg: "text-lg min-w-[4ch]",
    },
    checked: {
      true: "",
      false: "",
    },
    highlighted: {
      true: "",
      false: "",
    },
  },
  compoundVariants: [
    { checked: true, highlighted: false, className: "text-success" },
  ],
  defaultVariants: {
    size: "md",
    checked: false,
    highlighted: false,
  },
});

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

export const selectableDescriptionVariants = cva("text-sm mt-0.5", {
  variants: {
    highlighted: {
      true: "text-foreground/70",
      false: "text-muted-foreground",
    },
  },
  defaultVariants: {
    highlighted: false,
  },
});
