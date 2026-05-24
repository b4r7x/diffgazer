import { cva } from "class-variance-authority";

export type SegmentedVariant = "default" | "bracket" | "pill" | "underline";
export type SegmentedSize = "sm" | "md";

export const segmentedContainerVariants = cva("inline-flex font-mono", {
  variants: {
    variant: {
      default: "gap-1.5",
      bracket: "gap-0.5",
      pill: "relative isolate border border-border bg-background p-[3px]",
      underline: "relative gap-6 border-b border-border",
    },
    orientation: {
      horizontal: "",
      vertical: "flex-col",
    },
  },
  compoundVariants: [
    { variant: "underline", orientation: "vertical", className: "gap-1 border-b-0 border-r" },
  ],
  defaultVariants: {
    variant: "default",
    orientation: "horizontal",
  },
});

// JBMono is monospaced so bold-on-active doesn't shift glyph widths.
// If a proportional font is ever used, active items will need explicit min-width.
export const segmentedItemVariants = cva(
  [
    "relative inline-flex items-center justify-center whitespace-nowrap font-mono",
    "cursor-pointer select-none bg-transparent transition-colors motion-reduce:transition-none",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "data-[active=true]:font-bold",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "border border-border text-foreground",
          "hover:bg-secondary",
          "data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary",
          "data-[active=true]:hover:bg-primary",
        ].join(" "),
        bracket: [
          "border border-transparent text-muted-foreground",
          "hover:text-foreground",
          "data-[active=true]:text-foreground",
        ].join(" "),
        pill: [
          "z-[1] border-0 text-muted-foreground",
          "hover:text-foreground",
          "data-[active=true]:text-primary-foreground",
        ].join(" "),
        underline: [
          "border-0 text-muted-foreground",
          "hover:text-foreground",
          "data-[active=true]:text-foreground",
        ].join(" "),
      },
      size: {
        // sm = docs-toolbar density (36px). Assumes pointer:fine.
        // md = WCAG 2.5.8 touch target (44px). Use for mobile primary actions
        //      and any control consumed on coarse-pointer devices.
        sm: "min-h-9 px-3 text-xs",
        md: "min-h-11 px-4 text-sm",
      },
      highlighted: {
        true: "",
      },
    },
    compoundVariants: [
      // Pill items add inner vertical padding so the label nests cleanly inside
      // the 3px-inset pill track; row height inherits from sm/md above.
      { variant: "pill", size: "sm", className: "py-1.5" },
      { variant: "pill", size: "md", className: "py-2" },
      // Underline items have no horizontal padding by default — gap on the row
      // provides spacing; padding would create a clickable border-bottom strip
      // that lies past the label. Vertical padding is added for visual weight
      // without dropping the touch-target height.
      { variant: "underline", size: "sm", className: "px-1 pb-2" },
      { variant: "underline", size: "md", className: "px-1 pb-3" },
      // Highlighted-but-not-active focus state for variants that wear a
      // background fill on hover. Pill and underline manage their own highlight
      // via the indicator/border so they opt out.
      { variant: "default", highlighted: true, className: "bg-secondary" },
      { variant: "bracket", highlighted: true, className: "text-foreground" },
    ],
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  },
);

export const segmentedPillIndicatorClass =
  "pointer-events-none absolute top-[3px] bottom-[3px] z-0 bg-primary motion-safe:transition-[left,width] motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.2,0,0,1)]";

export const segmentedUnderlineIndicatorClass =
  "pointer-events-none absolute bg-foreground motion-safe:transition-[left,width,top,height] motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.2,0,0,1)]";
