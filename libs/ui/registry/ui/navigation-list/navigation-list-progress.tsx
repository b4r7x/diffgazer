"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Allowed progress variant values. */
type ProgressVariant = "block" | "bar";

/** Class variants for progress color. */
export const progressColorVariants = cva("", {
  variants: {
    color: {
      success: "text-success",
      warning: "text-warning",
      error: "text-error",
      muted: "text-muted-foreground",
    },
  },
  defaultVariants: { color: "muted" },
});

type ProgressColor = "auto" | NonNullable<VariantProps<typeof progressColorVariants>["color"]>;

/** Props for navigation list progress. */
export interface NavigationListProgressProps {
  /** Progress percentage (0-100). */
  value: number;
  /** Bar style. "block" uses █░ characters, "bar" uses [==-] characters. */
  variant?: ProgressVariant;
  /** Number of characters for the progress bar. Rounded down; invalid values become zero. */
  width?: number;
  /** Color token. Auto selects color based on value thresholds. */
  color?: ProgressColor;
  /** Shows percentage text after the bar. */
  showLabel?: boolean;
  /** Additional class names merged onto the rendered element. */
  className?: string;
}

function resolveColorKey(value: number, color: ProgressColor): Exclude<ProgressColor, "auto"> {
  if (color !== "auto") return color;
  if (value === 0) return "muted";
  if (value >= 80) return "success";
  if (value >= 40) return "warning";
  return "error";
}

function buildBar(variant: ProgressVariant, filled: number, empty: number): string {
  if (variant === "bar") {
    return `[${"=".repeat(filled)}${"-".repeat(empty)}]`;
  }
  return `${"█".repeat(filled)}${"░".repeat(empty)}`;
}

/** ASCII progress bar (in Meta) */
export function NavigationListProgress({
  value: rawValue,
  variant = "block",
  width: rawWidth = 10,
  color = "auto",
  showLabel = true,
  className,
}: NavigationListProgressProps) {
  const value = Math.min(100, Math.max(0, rawValue));
  const width = Number.isFinite(rawWidth) ? Math.max(0, Math.floor(rawWidth)) : 0;
  const filled = Math.round((value / 100) * width);
  const empty = width - filled;
  const bar = buildBar(variant, filled, empty);
  const label = showLabel ? ` ${String(value).padStart(3)}%` : "";
  const colorKey = resolveColorKey(value, color);

  return (
    <span
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${value}% complete`}
      data-color={colorKey}
      className={cn(
        "font-mono text-2xs whitespace-pre leading-none",
        progressColorVariants({ color: colorKey }),
        "group-data-[highlighted]:text-primary-foreground/70",
        className,
      )}
    >
      {bar}
      {label}
    </span>
  );
}
