import { cva } from "class-variance-authority";
import { FOCUS_OUTLINE, HIGHLIGHT_OUTLINE } from "@/lib/focus-outline";

/** Visual style shared by segmented controls such as Tabs and ToggleGroup. */
export const SEGMENTED_VARIANTS = ["default", "bracket", "pill", "underline"] as const;
export type SegmentedVariant = (typeof SEGMENTED_VARIANTS)[number];
/** Segmented-control density. */
export type SegmentedSize = "sm" | "md";

/** Container variants for segmented controls. */
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
    wrapped: {
      true: "",
      false: "",
    },
  },
  compoundVariants: [
    // The vertical rail is the only structure line in a vertical tab list, so
    // it reads on --border-strong; the horizontal underline sits under dense
    // triggers and keeps the lighter --border.
    {
      variant: "underline",
      orientation: "vertical",
      className: "gap-1 border-b-0 border-r border-border-strong",
    },
    {
      orientation: "horizontal",
      wrapped: true,
      className: "max-w-full min-w-0 flex-wrap",
    },
    {
      variant: "pill",
      orientation: "horizontal",
      wrapped: true,
      className: "gap-1.5 border-0 bg-transparent p-0",
    },
    {
      variant: "underline",
      orientation: "horizontal",
      wrapped: true,
      className: "gap-x-6 gap-y-1 border-b-0",
    },
  ],
  defaultVariants: {
    variant: "default",
    orientation: "horizontal",
    wrapped: false,
  },
});

// JBMono is monospaced so bold-on-active doesn't shift glyph widths.
// If a proportional font is ever used, active items will need explicit min-width.
/** Item variants for segmented controls, including active/on data-state styling. */
export const segmentedItemVariants = cva(
  [
    "relative inline-flex items-center justify-center whitespace-nowrap font-mono",
    "cursor-pointer select-none bg-transparent transition-colors motion-reduce:transition-none",
    FOCUS_OUTLINE,
    "disabled:cursor-not-allowed disabled:opacity-50",
    // Tabs emit data-state="active"; ToggleGroup emits data-state="on" — one
    // shared selected-state style reads both per the data-attribute vocabulary.
    "data-[state=active]:font-bold data-[state=on]:font-bold",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "border border-border text-foreground",
          "hover:bg-secondary",
          "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary",
          "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary",
          "data-[state=active]:hover:bg-primary data-[state=on]:hover:bg-primary",
        ].join(" "),
        bracket: [
          "border border-transparent text-muted-foreground",
          "hover:text-foreground",
          "data-[state=active]:text-foreground data-[state=on]:text-foreground",
        ].join(" "),
        pill: [
          "z-[1] border-0 text-muted-foreground",
          "hover:text-foreground",
          "data-[state=active]:text-primary-foreground data-[state=on]:text-primary-foreground",
        ].join(" "),
        underline: [
          "border-0 text-muted-foreground",
          "hover:text-foreground",
          "data-[state=active]:text-foreground data-[state=on]:text-foreground",
        ].join(" "),
      },
      size: {
        // sm = docs-toolbar density (36px) on pointer:fine; auto-raises to the
        //      44px touch target on pointer:coarse.
        // md = WCAG 2.5.8 touch target (44px) always. Use for mobile primary
        //      actions and any control consumed on coarse-pointer devices.
        sm: "min-h-9 px-3 text-xs pointer-coarse:min-h-11",
        md: "min-h-11 px-4 text-sm",
      },
      // Virtual focus from a parent collection wears the same outside ring as
      // real focus (one focus grammar, one token), just without focus-visible.
      highlighted: {
        true: HIGHLIGHT_OUTLINE,
      },
      wrapped: {
        true: "max-w-full min-w-0 shrink-0 whitespace-normal break-words",
        false: "",
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
      {
        variant: "pill",
        wrapped: true,
        className:
          "data-[state=active]:bg-primary data-[state=on]:bg-primary data-[state=active]:text-primary-foreground data-[state=on]:text-primary-foreground",
      },
      {
        variant: "underline",
        wrapped: true,
        className:
          "border-x-0 border-t-0 border-b border-transparent data-[state=active]:border-b-foreground data-[state=on]:border-b-foreground",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "sm",
      wrapped: false,
    },
  },
);

/** Absolute indicator class used by pill segmented controls. */
export const segmentedPillIndicatorClass =
  "pointer-events-none absolute top-[3px] bottom-[3px] z-0 bg-primary motion-safe:transition-[left,width] motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.2,0,0,1)]";

/** Absolute indicator class used by underline segmented controls. */
export const segmentedUnderlineIndicatorClass =
  "pointer-events-none absolute bg-foreground motion-safe:transition-[left,width,top,height] motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.2,0,0,1)]";
