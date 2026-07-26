import { cva } from "class-variance-authority";
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

/**
 * Step row layout for vertical steppers. Single column: the trigger owns the indicator/label row
 * internally, and StepperContent stacks underneath it. A two-column track put expanded content
 * beside the trigger instead of below it.
 */
export const stepperStepVariants = cva(
  "relative grid grid-cols-1 items-start py-4 [counter-increment:step]",
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
      // Completed reads --primary, not --success: progress is a neutral control state, and the
      // status palette stays reserved for meaning (error keeps --error). --primary is monochrome
      // in both themes, so completed steps look the same in dark and light.
      // ASCII — color the glyph by state.
      { variant: "ascii", status: "completed", className: "text-primary" },
      { variant: "ascii", status: "active", className: "text-foreground" },
      { variant: "ascii", status: "error", className: "text-error" },
      { variant: "ascii", status: "skipped", className: "text-muted-foreground opacity-60" },
      { variant: "ascii", status: "disabled", className: "text-muted-foreground opacity-40" },

      // Numbered — invert active, fill completed/error, dashed skipped, dim disabled.
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
      {
        variant: "numbered",
        status: "error",
        className: "bg-error border-error text-background",
      },
      { variant: "numbered", status: "skipped", className: "border-dashed" },
      { variant: "numbered", status: "disabled", className: "opacity-40" },

      // Bullet — single glyph color swap.
      { variant: "bullet", status: "completed", className: "text-primary" },
      { variant: "bullet", status: "active", className: "text-foreground" },
      { variant: "bullet", status: "error", className: "text-error" },
      { variant: "bullet", status: "skipped", className: "text-muted-foreground opacity-60" },
      { variant: "bullet", status: "disabled", className: "text-muted-foreground opacity-40" },

      // Tag — color the border + label, invert active with bg-foreground.
      {
        variant: "tag",
        status: "completed",
        className: "text-primary border-primary",
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
      { variant: "progress", status: "completed", className: "text-primary" },
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
  "flex items-start gap-2.5 appearance-none bg-transparent border-0 text-left w-full " +
    "px-0 py-2 -my-2 pointer-coarse:my-0 pointer-coarse:min-h-11 " +
    "font-[inherit] cursor-pointer rounded-none " +
    "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 " +
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
