"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Allowed progress size values. */
export type ProgressSize = NonNullable<VariantProps<typeof progressVariants>["size"]>;

/** Props for progress. */
export interface ProgressProps
  extends Omit<
    ComponentProps<"div">,
    "role" | "aria-valuenow" | "aria-valuemin" | "aria-valuemax" | "aria-valuetext"
  > {
  /** Current progress value (0-100). Omit for indeterminate mode. */
  value?: number;
  /** Maximum value for the progress bar. */
  max?: number;
  /** Height of the progress bar track. */
  size?: ProgressSize;
  /** Custom text exposed through aria-valuetext for the current value. */
  valueText?: string;
}

/** Class variants for track. */
export const progressVariants = cva(
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

/** Root element with track and fill. Pass value for determinate, omit for indeterminate. */
export function Progress({
  value,
  max = 100,
  size = "md",
  valueText,
  className,
  ...props
}: ProgressProps) {
  const normalizedMax = Number.isFinite(max) && max > 0 ? max : 100;
  const isIndeterminate = value === undefined;
  const clampedValue = isIndeterminate ? undefined : Math.min(Math.max(0, value), normalizedMax);
  const percentage = clampedValue === undefined ? undefined : (clampedValue / normalizedMax) * 100;

  return (
    <div
      {...props}
      role="progressbar"
      data-slot="progress"
      data-state={isIndeterminate ? "indeterminate" : "loaded"}
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={normalizedMax}
      aria-valuetext={valueText}
      className={cn(progressVariants({ size }), className)}
    >
      <div
        data-slot="progress-indicator"
        className={cn(
          "h-full bg-foreground transition-[width] duration-150",
          isIndeterminate && "progress-indeterminate",
        )}
        style={isIndeterminate ? undefined : { width: `${percentage}%` }}
      />
    </div>
  );
}
