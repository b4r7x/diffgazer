import { cva, type VariantProps } from "class-variance-authority";
import type { HorizontalStepStatus } from "./step-status";

/**
 * Root variants for horizontal steppers.
 *
 * The root declares the `horizontal-stepper` container so the compact treatment switches on the
 * space the stepper actually gets, not on the viewport. `w-full` keeps the container measurable
 * when the stepper sits in a shrink-to-fit parent (inline-size containment would otherwise collapse
 * it to zero).
 */
export const horizontalStepperRootVariants = cva(
  "@container/horizontal-stepper flex w-full min-w-0 items-center list-none m-0 p-0 font-mono tabular-nums",
  {
    variants: {
      variant: {
        ascii: "text-[12px] gap-0",
        numbered: "text-2xs gap-0 items-start [counter-reset:step]",
        breadcrumb: "text-[12px] gap-1.5",
      },
    },
    defaultVariants: { variant: "ascii" },
  },
);

/** Visual style for horizontal stepper indicators. */
export type HorizontalStepperVariant = NonNullable<
  VariantProps<typeof horizontalStepperRootVariants>["variant"]
>;

/**
 * Step layout variants for horizontal steppers.
 *
 * `shrink-0 whitespace-nowrap` is the overflow contract: a step never breaks internally, so labels
 * cannot wrap mid-word and the `[ ]` glyph cannot split across two lines. The numbered variant grows
 * with `grow basis-0` instead of `flex-1` so it keeps the shared `flex-shrink: 0`.
 */
export const horizontalStepperStepVariants = cva(
  "relative inline-flex items-center shrink-0 whitespace-nowrap",
  {
    variants: {
      variant: {
        ascii: "gap-1.5",
        numbered:
          "flex-col gap-1.5 grow basis-0 min-w-[80px] [counter-increment:step] " +
          // Connector line above the label, behind the indicator square.
          "before:content-[''] before:absolute before:top-[11px] before:h-px before:bg-border-strong before:z-0 " +
          "before:left-[calc(-50%+11px)] before:right-[calc(50%+11px)] " +
          "first:before:hidden " +
          // Only a segment leading INTO a completed indicator fills; --primary (not --success)
          // keeps progress monochrome in both palettes. data-status is already on the <li>, so
          // the connector needs no second attribute.
          "data-[status=completed]:before:bg-primary " +
          // Text-only tier: the surrounding steps are gone, so the segment would draw across
          // the bare label.
          "@max-xs/horizontal-stepper:before:hidden",
        breadcrumb: "gap-1 text-muted-foreground",
      },
    },
    defaultVariants: { variant: "ascii" },
  },
);

/** Glyph variants for horizontal steppers. */
export const horizontalStepperGlyphVariants = cva("font-mono tabular-nums", {
  variants: {
    variant: {
      ascii: "text-[12px] font-semibold",
      numbered:
        "w-[22px] h-[22px] inline-flex items-center justify-center text-[11px] font-semibold " +
        "border border-border-strong bg-background text-muted-foreground relative z-[1]",
      breadcrumb: "text-[12px] font-semibold",
    },
    // Glyph tone. ascii and breadcrumb share it; numbered inverts the whole square below and
    // wins through cn()/twMerge, which drops the text color it conflicts with.
    status: {
      pending: "text-muted-foreground",
      active: "text-foreground",
      completed: "text-primary",
    },
  },
  compoundVariants: [
    // Numbered (inverted square)
    {
      variant: "numbered",
      status: "completed",
      className: "bg-primary border-primary text-primary-foreground",
    },
    {
      variant: "numbered",
      status: "active",
      className: "bg-foreground border-foreground text-background",
    },
  ],
  defaultVariants: { variant: "ascii", status: "pending" },
});

/** Label variants for horizontal steppers. */
export const horizontalStepperLabelVariants = cva("font-mono", {
  variants: {
    variant: {
      ascii: "text-[12px]",
      numbered: "text-2xs uppercase tracking-[0.08em] min-w-[6ch] text-center",
      breadcrumb: "text-[12px]",
    },
    status: {
      pending: "text-muted-foreground",
      active: "text-foreground font-semibold",
      completed: "text-foreground",
    },
  },
  compoundVariants: [
    // Breadcrumb completed labels stay dim (path-history feel).
    { variant: "breadcrumb", status: "completed", className: "text-muted-foreground" },
  ],
  defaultVariants: { variant: "ascii", status: "pending" },
});

/** Connector class between horizontal stepper items. */
export const horizontalStepperConnectorClass = "mx-1.5 text-border-strong";

/** Connector class for a segment leading into a completed step. */
export const horizontalStepperCompletedConnectorClass = "text-primary";

/** Separator class for breadcrumb-style horizontal steppers. */
export const horizontalStepperBreadcrumbSeparatorClass = "text-border-strong";

/**
 * Connector list item between steps. Connectors disappear under the compact treatment so the
 * indicators collapse into a single `[x][x][~][ ]` run.
 *
 * The base string carries no display utility: `inline-flex` belongs to the non-compact branch so
 * the whole display decision reads in one place. `cn()` would resolve a base `inline-flex` against
 * a later `hidden` anyway — twMerge keeps the last utility of the display group — so this is a
 * readability split, not a specificity workaround.
 */
export const horizontalStepperConnectorItemClass = "items-center shrink-0 whitespace-nowrap";

/** Display branch for the connector list item under the compact treatment. */
export function horizontalStepperConnectorDisplayClass(compact: boolean): string {
  return compact ? "hidden" : "inline-flex @max-xl/horizontal-stepper:hidden";
}

/**
 * Second compact tier, for containers too narrow for even the connector-less glyph run: a six-step
 * ascii run measures 276px at its longest label, so below 20rem the run is dropped and the stepper
 * reads as plain `Step 5/6 · Analysis` text. Applied to the glyphs and to every non-active step.
 *
 * `sr-only` rather than `hidden`, matching the tier-1 label collapse: the collapsed steps leave the
 * layout but stay in the accessibility tree, so all six are still announced.
 */
export const horizontalStepperTextOnlyCollapseClass = "@max-xs/horizontal-stepper:sr-only";

/**
 * "Step 3/6 ·" prefix shown in front of the active label. It only appears under the compact
 * treatment, where it carries the position information the hidden labels no longer show.
 */
export const horizontalStepperCounterClass =
  "me-1 shrink-0 whitespace-nowrap font-normal text-muted-foreground";

/** Visibility branch for the counter prefix: shown only under the compact treatment. */
export function horizontalStepperCounterVisibilityClass(compact: boolean): string {
  return compact ? "" : "hidden @max-xl/horizontal-stepper:inline";
}

/** Status glyphs for non-numbered horizontal stepper variants. */
export const HORIZONTAL_STEP_INDICATOR_GLYPHS: Record<
  Exclude<HorizontalStepperVariant, "numbered">,
  Record<HorizontalStepStatus, string>
> = {
  ascii: {
    completed: "[x]",
    active: "[~]",
    pending: "[ ]",
  },
  breadcrumb: {
    completed: "✓",
    active: "›",
    pending: "",
  },
};
