"use client";

import type { Ref } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

export type ProgressSize = "sm" | "md";

export interface ProgressProps {
  value?: number;
  max?: number;
  size?: ProgressSize;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  ref?: Ref<HTMLDivElement>;
}

const trackVariants = cva(
  "relative w-full overflow-hidden rounded-sm bg-secondary font-mono",
  {
    variants: {
      size: {
        sm: "h-1",
        md: "h-2",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export function Progress({
  value,
  max = 100,
  size = "md",
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ref,
}: ProgressProps) {
  const isIndeterminate = value === undefined;
  const clampedValue = isIndeterminate
    ? undefined
    : Math.min(Math.max(0, value), max);
  const percentage = isIndeterminate ? undefined : (clampedValue! / max) * 100;

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cn(trackVariants({ size }), className)}
    >
      <div
        className={cn(
          "h-full bg-foreground transition-[width] duration-150",
          isIndeterminate && "progress-indeterminate",
        )}
        style={
          isIndeterminate ? undefined : { width: `${percentage}%` }
        }
      />
    </div>
  );
}
