import { cva } from "class-variance-authority";

/**
 * Shared visual contract for segmented controls (ToggleGroup, Tabs).
 *
 * The variant decides the chrome (joined-bordered row vs inset pill track vs
 * gapped underline tabs vs frameless bracket markers). The same CVA is used by
 * both primitives so pixels stay locked; ARIA stays on each primitive's root
 * (role="radiogroup|group" for ToggleGroup, role="tablist" for Tabs).
 */
export type SegmentedVariant = "default" | "bracket" | "pill" | "underline";
export type SegmentedSize = "sm" | "md";

export const segmentedContainerVariants = cva("flex font-mono", {
  variants: {
    variant: {
      default: "gap-1.5",
      bracket: "gap-0.5",
      pill: "relative isolate border border-border bg-background p-[3px]",
      underline: "gap-6 border-b border-border",
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

/**
 * Single item visual contract. JetBrains Mono is monospaced so the 400 → 700
 * weight bump on active items does not change glyph advance widths, and no
 * width-reservation pseudo-element is needed. If the library is ever used with
 * a proportional font, the active item will need an explicit `min-width`
 * derived from its bold rendering.
 *
 * Active-hover precedence: each variant ships `hover:` *and*
 * `data-[active=true]:hover:` rules. The latter wins on equal specificity by
 * adding one attribute selector, so hover on the active item keeps the active
 * background instead of leaking to the inactive hover tone. This pattern is
 * Tailwind v3- and v4-safe (no `not-*` modifier required).
 */
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
          "border-0 border-b border-transparent -mb-px text-muted-foreground",
          "hover:text-foreground",
          "data-[active=true]:text-foreground data-[active=true]:border-b-foreground",
        ].join(" "),
      },
      size: {
        // sm = docs-toolbar density (36px). Assumes pointer:fine.
        // md = WCAG 2.5.8 touch target (44px). Use for mobile primary actions
        //      and any control consumed on coarse-pointer devices.
        sm: "min-h-9 px-3 text-xs",
        md: "min-h-11 px-4 text-sm",
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
      { variant: "underline", size: "sm", className: "px-0 pb-2" },
      { variant: "underline", size: "md", className: "px-0 pb-3" },
    ],
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  },
);

/**
 * Sliding indicator pill. Positioned absolutely inside the pill-variant
 * container; its `left`/`width` are written by `useFloatingIndicator`.
 */
export const segmentedPillIndicatorClass =
  "pointer-events-none absolute top-[3px] bottom-[3px] z-0 bg-primary motion-safe:transition-[left,width] motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.2,0,0,1)]";
