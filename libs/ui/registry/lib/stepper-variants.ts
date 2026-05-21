import { cva } from "class-variance-authority";
import type { StepStatus } from "./step-status";

/**
 * Shared visual contract for the vertical Stepper.
 *
 * Five variants change how the indicator glyph and connector line render. The
 * 1ch / fixed-width indicator across all five variants keeps every label
 * aligned regardless of state, and the active state never adds weight to the
 * label (`font-bold` shifts neighbour widths on proportional fallbacks). Active
 * is signalled by glyph swap + color, not by typography size.
 *
 * `data-variant` is written on the root <ol> and `data-status` is written on
 * each <li> so theme overrides can target any variant × state cell.
 */
export type StepperVariant = "ascii" | "numbered" | "bullet" | "tag" | "progress";

/**
 * Horizontal Stepper variants. H1/H3 share the inline glyph + label layout; H2
 * stacks a numbered square above the connector line (Material-flavoured).
 */
export type HorizontalStepperVariant = "ascii" | "numbered" | "breadcrumb";

export type StepperOrientation = "vertical" | "horizontal";

/**
 * Root container. Connector lines render through `::before` pseudo-elements on
 * the <li> in CSS-counter aware variants (numbered). For variants without
 * counters, the connector still draws via the same `::before` driven by
 * `data-status`.
 */
export const stepperRootVariants = cva("flex flex-col list-none m-0 p-0 font-mono", {
  variants: {
    variant: {
      ascii: "[counter-reset:step] gap-0",
      numbered: "[counter-reset:step] gap-0",
      bullet: "gap-0",
      tag: "gap-1",
      progress: "gap-0",
    },
  },
  defaultVariants: { variant: "ascii" },
});

/**
 * Item (<li>) wrapper. `relative` anchors the connector pseudo defined in
 * `shared/stepper.css` — geometry there lets the line overshoot the `<li>`
 * boundary at any row height (compact 30px rows clamped the utility version
 * to a 2px sliver). Variants opt in by data-variant; tag and progress have
 * no rule and therefore no connector.
 *
 * Layout: `grid grid-cols-[auto_1fr]` so the indicator column is sized by its
 * content (1ch ascii, 20px numbered, 1ch bullet, 72px tag, 3ch progress) and
 * the label column flexes.
 */
export const stepperStepVariants = cva(
  "relative grid grid-cols-[auto_1fr] gap-x-2.5 items-start py-4 [counter-increment:step]",
);

/**
 * Indicator container shared across variants. Per-variant glyph sizing lives
 * in the indicator variant; this is the layout / typography spine.
 */
export const stepperIndicatorVariants = cva(
  "inline-flex shrink-0 font-mono tabular-nums leading-[1.4] select-none",
  {
    variants: {
      variant: {
        ascii: "text-[13px] font-semibold whitespace-nowrap",
        numbered:
          "w-5 h-5 items-center justify-center text-[11px] font-semibold border " +
          "border-border-strong bg-background text-muted-foreground",
        bullet: "w-[1ch] text-[14px] font-semibold justify-center",
        tag:
          "min-w-[72px] px-2 py-[2px] items-center justify-center text-[10px] font-semibold " +
          "uppercase tracking-[0.08em] border border-border-strong text-muted-foreground",
        progress: "text-[13px] font-semibold leading-none tracking-[-0.04em] text-border-strong",
      },
      status: {
        pending: "",
        active: "",
        completed: "",
        error: "",
        skipped: "",
        disabled: "",
      },
    },
    compoundVariants: [
      // ASCII — color the glyph by state.
      { variant: "ascii", status: "completed", className: "text-success" },
      { variant: "ascii", status: "active", className: "text-foreground" },
      { variant: "ascii", status: "error", className: "text-destructive" },
      { variant: "ascii", status: "skipped", className: "text-muted-foreground opacity-60" },
      { variant: "ascii", status: "disabled", className: "text-muted-foreground opacity-40" },

      // Numbered — invert active, fill completed/error, dashed skipped, dim disabled.
      {
        variant: "numbered",
        status: "completed",
        className: "bg-success border-success text-background",
      },
      {
        variant: "numbered",
        status: "active",
        className: "bg-foreground border-foreground text-background",
      },
      {
        variant: "numbered",
        status: "error",
        className: "bg-destructive border-destructive text-background",
      },
      { variant: "numbered", status: "skipped", className: "border-dashed" },
      { variant: "numbered", status: "disabled", className: "opacity-40" },

      // Bullet — single glyph color swap.
      { variant: "bullet", status: "completed", className: "text-success" },
      { variant: "bullet", status: "active", className: "text-foreground" },
      { variant: "bullet", status: "error", className: "text-destructive" },
      { variant: "bullet", status: "skipped", className: "text-muted-foreground opacity-60" },
      { variant: "bullet", status: "disabled", className: "text-muted-foreground opacity-40" },

      // Tag — color the border + label, invert active with bg-foreground.
      {
        variant: "tag",
        status: "completed",
        className: "text-success border-success",
      },
      {
        variant: "tag",
        status: "active",
        className: "bg-foreground border-foreground text-background",
      },
      {
        variant: "tag",
        status: "error",
        className: "text-destructive border-destructive",
      },
      {
        variant: "tag",
        status: "skipped",
        className: "border-dashed text-muted-foreground",
      },
      { variant: "tag", status: "disabled", className: "opacity-40" },

      // Progress — Unicode block bar color swap.
      { variant: "progress", status: "completed", className: "text-success" },
      { variant: "progress", status: "active", className: "text-foreground" },
      { variant: "progress", status: "error", className: "text-destructive" },
      { variant: "progress", status: "skipped", className: "text-muted-foreground opacity-60" },
      { variant: "progress", status: "disabled", className: "text-muted-foreground opacity-40" },
    ],
    defaultVariants: { variant: "ascii", status: "pending" },
  },
);

/**
 * Step label, shared across variants. State styling is uniform: active = bold
 * fg, completed = fg, pending = dim, error = destructive, skipped = strike-
 * through, disabled = dim + low opacity.
 */
export const stepperLabelVariants = cva("text-[13px] leading-[1.4] font-medium", {
  variants: {
    status: {
      pending: "text-muted-foreground",
      active: "text-foreground font-semibold",
      completed: "text-foreground",
      error: "text-destructive font-semibold",
      skipped: "text-muted-foreground line-through",
      disabled: "text-muted-foreground opacity-50",
    },
  },
  defaultVariants: { status: "pending" },
});

/**
 * Trigger button. Owns the click target + arrow-key handling. The active
 * background highlight applies only to `variant="tag"` to match the round-1
 * spec; other variants are chromeless rows.
 */
export const stepperTriggerVariants = cva(
  "flex items-start gap-2.5 appearance-none bg-transparent border-0 p-0 text-left w-full " +
    "font-[inherit] cursor-pointer rounded-none " +
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground " +
    "disabled:cursor-not-allowed " +
    "aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
);

/**
 * Glyph map for the static-content variants. The `ascii` "active" cell renders
 * a nested span (`<span class="cursor">~</span>`) for the blinking cursor so
 * it's intentionally omitted from this dictionary — the trigger renders that
 * cell directly.
 */
export const STEP_INDICATOR_GLYPHS: Record<
  Exclude<StepperVariant, "numbered">,
  Record<StepStatus, string>
> = {
  ascii: {
    completed: "[x]",
    active: "", // rendered as JSX with blinking cursor
    pending: "[ ]",
    error: "[!]",
    skipped: "[—]",
    disabled: "[/]",
  },
  bullet: {
    completed: "•",
    active: "›",
    pending: "·",
    error: "×",
    skipped: "—",
    disabled: "·",
  },
  tag: {
    completed: "DONE",
    active: "RUN",
    pending: "WAIT",
    error: "FAIL",
    skipped: "SKIP",
    disabled: "OFF",
  },
  progress: {
    completed: "███",
    active: "█▌░",
    pending: "░░░",
    error: "!!!",
    skipped: "———",
    disabled: "···",
  },
};

/**
 * Numbered variant's "completed" glyph; non-completed states render the CSS
 * counter via `::before { content: counter(step) }`. We don't put the counter
 * here because it needs the parent <li>'s counter scope.
 */
export const NUMBERED_COMPLETED_GLYPH = "✓";
export const NUMBERED_ERROR_GLYPH = "!";
export const NUMBERED_SKIPPED_GLYPH = "—";
export const NUMBERED_DISABLED_GLYPH = "·";

/* ========================================================================
 * Horizontal stepper variants
 * ====================================================================== */

export const horizontalStepperRootVariants = cva(
  "flex items-center list-none m-0 p-0 font-mono tabular-nums",
  {
    variants: {
      variant: {
        ascii: "text-[12px] gap-0",
        numbered: "text-[10px] gap-0 items-start [counter-reset:step]",
        breadcrumb: "text-[12px] gap-1.5",
      },
    },
    defaultVariants: { variant: "ascii" },
  },
);

export const horizontalStepperStepVariants = cva("relative inline-flex items-center", {
  variants: {
    variant: {
      ascii: "gap-1.5",
      numbered:
        "flex-col gap-1.5 flex-1 min-w-[80px] [counter-increment:step] " +
        // Connector line above the label, behind the indicator square.
        "before:content-[''] before:absolute before:top-[11px] before:h-px before:bg-border-strong before:z-0 " +
        "before:left-[calc(-50%+11px)] before:right-[calc(50%+11px)] " +
        "first:before:hidden " +
        "data-[conn-completed=true]:before:bg-success",
      breadcrumb: "gap-1 text-muted-foreground",
    },
  },
  defaultVariants: { variant: "ascii" },
});

export const horizontalStepperGlyphVariants = cva("font-mono tabular-nums", {
  variants: {
    variant: {
      ascii: "text-[12px] font-semibold",
      numbered:
        "w-[22px] h-[22px] inline-flex items-center justify-center text-[11px] font-semibold " +
        "border border-border-strong bg-background text-muted-foreground relative z-[1]",
      breadcrumb: "text-[12px] font-semibold",
    },
    status: {
      pending: "",
      active: "",
      completed: "",
      error: "",
      skipped: "",
      disabled: "",
    },
  },
  compoundVariants: [
    // H1 ascii
    { variant: "ascii", status: "completed", className: "text-success" },
    { variant: "ascii", status: "active", className: "text-foreground" },
    { variant: "ascii", status: "pending", className: "text-muted-foreground" },
    { variant: "ascii", status: "error", className: "text-destructive" },
    { variant: "ascii", status: "skipped", className: "text-muted-foreground opacity-60" },
    { variant: "ascii", status: "disabled", className: "text-muted-foreground opacity-40" },

    // H2 numbered (inverted square)
    {
      variant: "numbered",
      status: "completed",
      className: "bg-success border-success text-background",
    },
    {
      variant: "numbered",
      status: "active",
      className: "bg-foreground border-foreground text-background",
    },
    {
      variant: "numbered",
      status: "error",
      className: "bg-destructive border-destructive text-background",
    },
    { variant: "numbered", status: "skipped", className: "border-dashed" },
    { variant: "numbered", status: "disabled", className: "opacity-40" },

    // H3 breadcrumb (glyph)
    { variant: "breadcrumb", status: "completed", className: "text-success" },
    { variant: "breadcrumb", status: "active", className: "text-foreground" },
    { variant: "breadcrumb", status: "pending", className: "text-muted-foreground" },
    { variant: "breadcrumb", status: "error", className: "text-destructive" },
    { variant: "breadcrumb", status: "skipped", className: "text-muted-foreground opacity-60" },
    { variant: "breadcrumb", status: "disabled", className: "text-muted-foreground opacity-40" },
  ],
  defaultVariants: { variant: "ascii", status: "pending" },
});

export const horizontalStepperLabelVariants = cva("font-mono", {
  variants: {
    variant: {
      ascii: "text-[12px]",
      numbered: "text-[10px] uppercase tracking-[0.08em] min-w-[6ch] text-center",
      breadcrumb: "text-[12px]",
    },
    status: {
      pending: "text-muted-foreground",
      active: "text-foreground font-semibold",
      completed: "text-foreground",
      error: "text-destructive font-semibold",
      skipped: "text-muted-foreground line-through",
      disabled: "text-muted-foreground opacity-50",
    },
  },
  compoundVariants: [
    // Breadcrumb completed labels stay dim (path-history feel).
    { variant: "breadcrumb", status: "completed", className: "text-muted-foreground" },
  ],
  defaultVariants: { variant: "ascii", status: "pending" },
});

/** ASCII connector "── ── ──" between H1 steps. */
export const horizontalStepperConnectorClass =
  "mx-1.5 text-border-strong data-[completed=true]:text-success";

/** Breadcrumb separator "/" between H3 steps. */
export const horizontalStepperBreadcrumbSeparatorClass = "text-border-strong";

/**
 * Horizontal glyph dictionary mirrors the vertical contract: numbered uses CSS
 * counters for non-completed states, ascii/breadcrumb use literal glyphs.
 */
export const HORIZONTAL_STEP_INDICATOR_GLYPHS: Record<
  Exclude<HorizontalStepperVariant, "numbered">,
  Record<StepStatus, string>
> = {
  ascii: {
    completed: "[x]",
    active: "[~]",
    pending: "[ ]",
    error: "[!]",
    skipped: "[—]",
    disabled: "[/]",
  },
  breadcrumb: {
    completed: "✓",
    active: "›",
    pending: "",
    error: "×",
    skipped: "—",
    disabled: "·",
  },
};
