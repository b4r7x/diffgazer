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
          // Active-only tier: the surrounding steps are gone, so the segment would draw across
          // the bare label.
          "@max-[14rem]/horizontal-stepper:before:hidden",
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
 * Third compact tier, for containers too narrow for even a three-cell window: every non-active step
 * collapses and the stepper reads as `[~] Step 4/7 · Analysis`. The glyph run itself is never
 * dropped — the active glyph is the one thing a progress indicator cannot do without.
 *
 * `sr-only` rather than `hidden`, matching the tier-1 label collapse: the collapsed steps leave the
 * layout but stay in the accessibility tree, so every step is still announced.
 */
export const horizontalStepperActiveOnlyCollapseClass = "@max-[14rem]/horizontal-stepper:sr-only";

/** Elision marker type: `+2` / `+1` counters standing in for the steps the window hides. */
export const horizontalStepperElisionClass =
  "font-mono text-[12px] tabular-nums text-muted-foreground shrink-0";

/**
 * Window collapse (tier 2) and the matching elision-marker visibility, as complete class literals.
 *
 * The window keeps `previous / active / next` and elides the rest, which makes the run's min-content
 * width O(1) instead of O(N). It engages from NEED, not from a blanket width: the threshold is keyed
 * by (variant, step count), so a four-step ascii run keeps its full run down to 18rem while a
 * twelve-step run windows from 32rem.
 *
 * The thresholds come from a measured steps x widths x variants sweep of the real component, which
 * reads `scrollWidth <= clientWidth` on a synthesised N-step run at each ladder width with a
 * worst-case 12-character active label. Each entry is the narrowest ladder width at which the
 * un-windowed run still fits; below it the run overflows, so the window has to engage. Re-measure
 * and paste the table again if the ascii type scale or the numbered `min-w` changes.
 *
 * Both strings are written out in full for the reason spelled out on the tier-1 branches below:
 * Tailwind scans built JS for complete class strings, so a class assembled by interpolating a
 * `@max-[...]/horizontal-stepper:` prefix onto a variable ships the bare prefix and emits no utility.
 */
export interface HorizontalStepperWindowClasses {
  /** Applied to steps outside the window. */
  window: string;
  /** Applied to the elision markers, so they appear exactly when the window does. */
  elision: string;
}

const WINDOW_NEVER: HorizontalStepperWindowClasses = { window: "", elision: "hidden" };
const WINDOW_ALWAYS: HorizontalStepperWindowClasses = { window: "sr-only", elision: "inline" };
const WINDOW_AT = {
  "18rem": {
    window: "@max-[18rem]/horizontal-stepper:sr-only",
    elision: "hidden @max-[18rem]/horizontal-stepper:inline",
  },
  "22rem": {
    window: "@max-[22rem]/horizontal-stepper:sr-only",
    elision: "hidden @max-[22rem]/horizontal-stepper:inline",
  },
  "26rem": {
    window: "@max-[26rem]/horizontal-stepper:sr-only",
    elision: "hidden @max-[26rem]/horizontal-stepper:inline",
  },
  "32rem": {
    window: "@max-[32rem]/horizontal-stepper:sr-only",
    elision: "hidden @max-[32rem]/horizontal-stepper:inline",
  },
  "40rem": {
    window: "@max-[40rem]/horizontal-stepper:sr-only",
    elision: "hidden @max-[40rem]/horizontal-stepper:inline",
  },
  "48rem": {
    window: "@max-[48rem]/horizontal-stepper:sr-only",
    elision: "hidden @max-[48rem]/horizontal-stepper:inline",
  },
  "64rem": {
    window: "@max-[64rem]/horizontal-stepper:sr-only",
    elision: "hidden @max-[64rem]/horizontal-stepper:inline",
  },
} satisfies Record<string, HorizontalStepperWindowClasses>;

/** A ladder width the window engages below, `"always"` when no width fits, `null` when it never engages. */
type HorizontalStepperWindowThreshold = keyof typeof WINDOW_AT | "always" | null;

/** Swept fit table: [maximum step count, threshold]. `null` means the run never overflows. */
const WINDOW_TABLE: Record<
  HorizontalStepperVariant,
  ReadonlyArray<[number, HorizontalStepperWindowThreshold]>
> = {
  ascii: [
    [3, null],
    [5, "18rem"],
    [8, "22rem"],
    [10, "26rem"],
    [Number.POSITIVE_INFINITY, "32rem"],
  ],
  breadcrumb: [
    [4, null],
    [9, "18rem"],
    [12, "22rem"],
    [Number.POSITIVE_INFINITY, "26rem"],
  ],
  numbered: [
    [3, null],
    [7, "40rem"],
    [9, "48rem"],
    [11, "64rem"],
    // Beyond eleven the numbered run overflows every ladder width, so it always windows.
    [Number.POSITIVE_INFINITY, "always"],
  ],
};

/** Resolves the window/elision class pair for a stepper of this variant and step count. */
export function horizontalStepperWindowClasses(
  variant: HorizontalStepperVariant,
  total: number,
  compact: boolean,
): HorizontalStepperWindowClasses {
  // At three steps or fewer the window IS the full run, so it must never engage: there is nothing
  // to elide and an elision marker reading `+0` would be a lie.
  if (total <= 3) return WINDOW_NEVER;
  if (compact) return WINDOW_ALWAYS;
  const entry = WINDOW_TABLE[variant].find(([maxTotal]) => total <= maxTotal);
  const threshold = entry?.[1] ?? null;
  if (threshold === null) return WINDOW_NEVER;
  if (threshold === "always") return WINDOW_ALWAYS;
  return WINDOW_AT[threshold];
}

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
