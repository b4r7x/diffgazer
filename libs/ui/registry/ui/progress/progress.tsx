import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Allowed progress size values. */
export type ProgressSize = NonNullable<VariantProps<typeof progressVariants>["size"]>;
/** Allowed progress variant values. */
export type ProgressVariant = NonNullable<VariantProps<typeof progressVariants>["variant"]>;

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
  /**
   * "cells" (default) cuts track and fill into hard-edged character cells.
   * "bar" keeps the continuous rounded track for hairline-thin inline uses.
   */
  variant?: ProgressVariant;
  /** Custom text exposed through aria-valuetext for the current value. */
  valueText?: string;
}

/** Class variants for track. */
export const progressVariants = cva("relative w-full overflow-hidden bg-border", {
  variants: {
    size: {
      sm: "h-1",
      md: "h-2",
    },
    variant: {
      cells: "",
      bar: "rounded-sm",
    },
  },
  compoundVariants: [
    // A 4px track cannot carry an 8px cell, so size="sm" falls back to the
    // continuous bar — including its radius. See progress.css.
    { variant: "cells", size: "sm", class: "rounded-sm" },
  ],
  defaultVariants: {
    size: "md",
    variant: "cells",
  },
});

/** Root element with track and fill. Pass value for determinate, omit for indeterminate. */
export function Progress({
  value,
  max = 100,
  size = "md",
  variant = "cells",
  valueText,
  className,
  ...props
}: ProgressProps) {
  const normalizedMax = Number.isFinite(max) && max > 0 ? max : 100;
  const isIndeterminate = value === undefined;
  const clampedValue =
    value === undefined
      ? undefined
      : Math.min(Math.max(0, Number.isNaN(value) ? 0 : value), normalizedMax);
  const percentage = clampedValue === undefined ? undefined : (clampedValue / normalizedMax) * 100;

  return (
    <div
      {...props}
      role="progressbar"
      data-slot="progress"
      data-state={isIndeterminate ? "indeterminate" : "loaded"}
      data-size={size}
      data-variant={variant}
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={normalizedMax}
      aria-valuetext={valueText}
      className={cn(progressVariants({ size, variant }), className)}
    >
      <div
        data-slot="progress-indicator"
        className={cn(
          "h-full bg-foreground motion-safe:transition-[width] motion-safe:duration-150",
          isIndeterminate && "progress-indeterminate",
        )}
        style={isIndeterminate ? undefined : { width: `${percentage}%` }}
      />
    </div>
  );
}
