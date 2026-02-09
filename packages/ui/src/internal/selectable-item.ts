import { cva, type VariantProps } from "class-variance-authority";

export const selectableItemVariants = cva(
  "flex cursor-pointer select-none font-mono relative",
  {
    variants: {
      focused: {
        true: "bg-tui-selection text-tui-fg font-bold before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-tui-blue",
        false: "text-tui-fg hover:bg-tui-selection/50",
      },
      disabled: {
        true: "opacity-50 cursor-not-allowed",
        false: "",
      },
    },
    defaultVariants: {
      focused: false,
      disabled: false,
    },
  }
);

export const selectableItemContainerVariants = cva(
  "flex items-center gap-3 px-3 py-2"
);

export const selectableItemIndicatorVariants = cva("font-bold shrink-0 whitespace-pre", {
  variants: {
    size: {
      sm: "text-sm min-w-4",
      md: "min-w-5",
      lg: "text-lg min-w-6",
    },
    checked: {
      true: "",
      false: "",
    },
    focused: {
      true: "",
      false: "",
    },
  },
  compoundVariants: [
    { checked: true, focused: false, className: "text-tui-green" },
  ],
  defaultVariants: {
    size: "md",
    checked: false,
    focused: false,
  },
});

export const selectableItemLabelVariants = cva("", {
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

export const selectableItemDescriptionVariants = cva("text-sm mt-0.5", {
  variants: {
    focused: {
      true: "text-tui-fg/70",
      false: "text-tui-muted",
    },
  },
  defaultVariants: {
    focused: false,
  },
});

export type SelectableItemSize = "sm" | "md" | "lg";
export type SelectableItemVariants = VariantProps<typeof selectableItemVariants>;
