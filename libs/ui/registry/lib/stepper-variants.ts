import { cva, type VariantProps } from "class-variance-authority";
import type { StepStatus } from "./step-status";

/** Visual style for vertical stepper indicators. */
export type StepperVariant = "ascii" | "numbered" | "bullet" | "tag" | "progress";

/** Stepper layout orientation. */
export type StepperOrientation = "vertical" | "horizontal";

/** Root variants for vertical steppers. */
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

/** Step row layout for vertical steppers. */
export const stepperStepVariants = cva(
  "relative grid grid-cols-[auto_1fr] gap-x-2.5 items-start py-4 [counter-increment:step]",
);

/** Indicator variants for vertical steppers. */
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
          "min-w-[72px] px-2 py-[2px] items-center justify-center text-2xs font-semibold " +
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
      { variant: "ascii", status: "error", className: "text-error" },
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
        className: "bg-error border-error text-background",
      },
      { variant: "numbered", status: "skipped", className: "border-dashed" },
      { variant: "numbered", status: "disabled", className: "opacity-40" },

      // Bullet — single glyph color swap.
      { variant: "bullet", status: "completed", className: "text-success" },
      { variant: "bullet", status: "active", className: "text-foreground" },
      { variant: "bullet", status: "error", className: "text-error" },
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
        className: "text-error border-error",
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
      { variant: "progress", status: "error", className: "text-error" },
      { variant: "progress", status: "skipped", className: "text-muted-foreground opacity-60" },
      { variant: "progress", status: "disabled", className: "text-muted-foreground opacity-40" },
    ],
    defaultVariants: { variant: "ascii", status: "pending" },
  },
);

/** Label variants for vertical steppers. */
export const stepperLabelVariants = cva("text-[13px] leading-[1.4] font-medium", {
  variants: {
    status: {
      pending: "text-muted-foreground",
      active: "text-foreground font-semibold",
      completed: "text-foreground",
      error: "text-error font-semibold",
      skipped: "text-muted-foreground line-through",
      disabled: "text-muted-foreground opacity-50",
    },
  },
  defaultVariants: { status: "pending" },
});

/** Button-like trigger variants for interactive stepper rows. */
export const stepperTriggerVariants = cva(
  "flex items-start gap-2.5 appearance-none bg-transparent border-0 p-0 text-left w-full " +
    "font-[inherit] cursor-pointer rounded-none " +
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground " +
    "disabled:cursor-not-allowed " +
    "aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
);

/** Status glyphs for non-numbered vertical stepper variants. The ascii active glyph is rendered as JSX. */
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

/** Completed glyph for numbered steppers. */
export const NUMBERED_COMPLETED_GLYPH = "✓";
/** Error glyph for numbered steppers. */
export const NUMBERED_ERROR_GLYPH = "!";
/** Skipped glyph for numbered steppers. */
export const NUMBERED_SKIPPED_GLYPH = "—";
/** Disabled glyph for numbered steppers. */
export const NUMBERED_DISABLED_GLYPH = "·";

/** Root variants for horizontal steppers. */
export const horizontalStepperRootVariants = cva(
  "flex items-center list-none m-0 p-0 font-mono tabular-nums",
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

/** Step layout variants for horizontal steppers. */
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
    { variant: "ascii", status: "error", className: "text-error" },
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
      className: "bg-error border-error text-background",
    },
    { variant: "numbered", status: "skipped", className: "border-dashed" },
    { variant: "numbered", status: "disabled", className: "opacity-40" },

    // H3 breadcrumb (glyph)
    { variant: "breadcrumb", status: "completed", className: "text-success" },
    { variant: "breadcrumb", status: "active", className: "text-foreground" },
    { variant: "breadcrumb", status: "pending", className: "text-muted-foreground" },
    { variant: "breadcrumb", status: "error", className: "text-error" },
    { variant: "breadcrumb", status: "skipped", className: "text-muted-foreground opacity-60" },
    { variant: "breadcrumb", status: "disabled", className: "text-muted-foreground opacity-40" },
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
      error: "text-error font-semibold",
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

/** Connector class between horizontal stepper items. */
export const horizontalStepperConnectorClass =
  "mx-1.5 text-border-strong data-[completed=true]:text-success";

/** Separator class for breadcrumb-style horizontal steppers. */
export const horizontalStepperBreadcrumbSeparatorClass = "text-border-strong";

/** Status glyphs for non-numbered horizontal stepper variants. */
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
