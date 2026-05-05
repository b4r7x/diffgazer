"use client";

import type { ReactNode, HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useSpinnerAnimation } from "./use-spinner-animation";
import { SnakeGrid, SNAKE_FRAME_COUNT } from "./spinner-snake-grid";

export type SpinnerSize = "sm" | "md" | "lg";
export type SpinnerVariant = "snake" | "braille" | "dots" | "pulse";
export type SpinnerLabelPosition = "right" | "left" | "top" | "bottom";
export type SpinnerGap = "none" | "sm" | "md" | "lg";

const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const DOTS_FRAMES = [".  ", ".. ", "..."] as const;
const PULSE_FRAMES = ["░", "▒", "▓", "█", "▓", "▒", "░"] as const;

// Fixed width prevents layout shift during dot animation ("." → ".." → "...")
const DOTS_FIXED_WIDTH = "w-7";

const VARIANT_CONFIG: Record<SpinnerVariant, { frames: number; speed: number }> = {
  snake: { frames: SNAKE_FRAME_COUNT, speed: 100 },
  braille: { frames: BRAILLE_FRAMES.length, speed: 80 },
  dots: { frames: DOTS_FRAMES.length, speed: 300 },
  pulse: { frames: PULSE_FRAMES.length, speed: 80 },
};

const spinnerVariants = cva("inline-flex items-center font-mono", {
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

export interface SpinnerProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof spinnerVariants> {
  variant?: SpinnerVariant;
  size?: SpinnerSize;
  labelPosition?: SpinnerLabelPosition;
  gap?: SpinnerGap;
  speed?: number;
  children?: ReactNode;
}

function SpinnerAnimation({ variant, frame, size }: { variant: SpinnerVariant; frame: number; size: SpinnerSize }) {
  const safeFrame = frame % VARIANT_CONFIG[variant].frames;
  if (variant === "snake") return <SnakeGrid frame={safeFrame} size={size} />;
  if (variant === "braille") return <>{BRAILLE_FRAMES[safeFrame]}</>;
  if (variant === "dots") {
    return <span className={cn("inline-block whitespace-pre", DOTS_FIXED_WIDTH)}>{DOTS_FRAMES[safeFrame]}</span>;
  }
  return <>{PULSE_FRAMES[safeFrame]}</>;
}

export function Spinner({
  variant = "snake",
  size,
  labelPosition,
  gap,
  speed,
  className,
  children,
  ...props
}: SpinnerProps) {
  const { frames: totalFrames, speed: defaultSpeed } = VARIANT_CONFIG[variant];
  const frame = useSpinnerAnimation({ totalFrames, speed: speed ?? defaultSpeed });
  const resolvedSize = size ?? "md";

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={children ? undefined : "Loading"}
      className={cn(
        spinnerVariants({ size: resolvedSize, labelPosition, gap }),
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="inline-flex items-center">
        <SpinnerAnimation variant={variant} frame={frame} size={resolvedSize} />
      </span>
      {children}
    </span>
  );
}
