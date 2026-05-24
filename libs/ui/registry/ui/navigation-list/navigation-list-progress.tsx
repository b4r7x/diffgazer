"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

type ProgressVariant = "block" | "bar";

export const progressColorVariants = cva("", {
  variants: {
    color: {
      success: "text-success",
      warning: "text-warning",
      error: "text-destructive",
      muted: "text-muted-foreground",
    },
  },
  defaultVariants: { color: "muted" },
});

type ProgressColor = "auto" | NonNullable<VariantProps<typeof progressColorVariants>["color"]>;

export interface NavigationListProgressProps {
  value: number;
  variant?: ProgressVariant;
  width?: number;
  color?: ProgressColor;
  showLabel?: boolean;
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

export function NavigationListProgress({
  value: rawValue,
  variant = "block",
  width = 10,
  color = "auto",
  showLabel = true,
  className,
}: NavigationListProgressProps) {
  const value = Math.min(100, Math.max(0, rawValue));
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
        "font-mono text-[10px] whitespace-pre leading-none",
        progressColorVariants({ color: colorKey }),
        "group-data-[active]:text-primary-foreground/70",
        className,
      )}
    >
      {bar}{label}
    </span>
  );
}
