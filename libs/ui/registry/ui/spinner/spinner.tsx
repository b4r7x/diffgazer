"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SNAKE_FRAME_COUNT, SnakeGrid, type SpinnerSize } from "./spinner-snake-grid";
import { useSpinnerAnimation } from "./use-animation";

export type { SpinnerSize } from "./spinner-snake-grid";
/** Allowed spinner variant values. */
export type SpinnerVariant = "snake" | "braille" | "dots" | "pulse";
/** Allowed spinner label position values. */
export type SpinnerLabelPosition = "right" | "left" | "top" | "bottom";
export type SpinnerGap = "none" | "sm" | "md" | "lg";

const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const DOTS_FRAMES = [".  ", ".. ", "..."] as const;
const PULSE_FRAMES = ["░", "▒", "▓", "█", "▓", "▒", "░"] as const;

const VARIANT_CONFIG: Record<SpinnerVariant, { frames: number; speed: number }> = {
  snake: { frames: SNAKE_FRAME_COUNT, speed: 100 },
  braille: { frames: BRAILLE_FRAMES.length, speed: 80 },
  dots: { frames: DOTS_FRAMES.length, speed: 300 },
  pulse: { frames: PULSE_FRAMES.length, speed: 80 },
};

/** Class variants for spinner. */
export const spinnerVariants = cva("inline-flex items-center font-mono", {
  variants: {
    size: {
      sm: "text-xs",
      md: "text-sm",
      lg: "text-base",
    },
    labelPosition: {
      right: "flex-row",
      left: "flex-row-reverse",
      bottom: "flex-col",
      top: "flex-col-reverse",
    },
    gap: {
      none: "gap-0",
      sm: "gap-1",
      md: "gap-2",
      lg: "gap-3",
    },
  },
  defaultVariants: { size: "md", labelPosition: "right", gap: "md" },
});

/** Props for spinner. */
export interface SpinnerProps extends ComponentProps<"span">, VariantProps<typeof spinnerVariants> {
  /**
   * Animation style. Snake renders a 3x3 pixel grid; braille, dots, and pulse render text glyph
   * sequences.
   */
  variant?: SpinnerVariant;
  /** Font size token applied to the glyph and label. */
  size?: SpinnerSize;
  /** Placement of the children label relative to the spinner glyph. */
  labelPosition?: SpinnerLabelPosition;
  /** Space between the spinner glyph and its label. */
  gap?: SpinnerGap;
  /**
   * Frame interval in milliseconds. Overrides the variant default (snake 100, braille 80, dots
   * 300, pulse 80).
   */
  speed?: number;
  /** Optional label. When omitted, the spinner uses aria-label="Loading". */
  children?: ReactNode;
}

/*
 * Every variant animates inside one em-square box, so swapping variant (or
 * cycling frames) never moves the label. 2em is the largest footprint any
 * variant needs: the lg snake grid measures 3×8px dots + 2×4px gaps = 32px at
 * its 16px font size, and the widest dots frame reserves 3ch ≈ 1.8em. Sizing in
 * em makes the box track the size variant's font size.
 */
const GLYPH_BOX = "inline-flex size-[2em] shrink-0 items-center justify-center";

function SpinnerAnimation({
  variant,
  frame,
  size,
}: {
  variant: SpinnerVariant;
  frame: number;
  size: SpinnerSize;
}) {
  const safeFrame = frame % VARIANT_CONFIG[variant].frames;
  if (variant === "snake") return <SnakeGrid frame={safeFrame} size={size} />;
  if (variant === "braille") return <>{BRAILLE_FRAMES[safeFrame]}</>;
  // The dots frames grow rightward from a fixed 3ch block instead of centering
  // per frame, so "." → ".." → "..." keeps the leading dot in place.
  if (variant === "dots") {
    return <span className="inline-block w-[3ch] whitespace-pre">{DOTS_FRAMES[safeFrame]}</span>;
  }
  return <>{PULSE_FRAMES[safeFrame]}</>;
}

/**
 * Root element - renders the animation glyph. Accepts variant, size, labelPosition, gap, and
 * speed props. Pass children for a label.
 */
export function Spinner({
  variant = "snake",
  size,
  labelPosition,
  gap,
  speed: requestedSpeed,
  className,
  children,
  ref,
  ...props
}: SpinnerProps) {
  const { frames: totalFrames, speed: defaultSpeed } = VARIANT_CONFIG[variant];
  const resolvedSpeed =
    typeof requestedSpeed === "number" && Number.isFinite(requestedSpeed) && requestedSpeed > 0
      ? requestedSpeed
      : defaultSpeed;
  const frame = useSpinnerAnimation({ totalFrames, speed: resolvedSpeed });
  const resolvedSize = size ?? "md";

  return (
    // biome-ignore lint/a11y/useSemanticElements: role="status" is the idiomatic loading live-region on an inline span; <output> carries form-association semantics that do not fit a spinner.
    <span
      ref={ref}
      role="status"
      data-slot="spinner"
      aria-label={children ? undefined : "Loading"}
      className={cn(spinnerVariants({ size: resolvedSize, labelPosition, gap }), className)}
      {...props}
    >
      <span aria-hidden="true" className={GLYPH_BOX}>
        <SpinnerAnimation variant={variant} frame={frame} size={resolvedSize} />
      </span>
      {children}
    </span>
  );
}
