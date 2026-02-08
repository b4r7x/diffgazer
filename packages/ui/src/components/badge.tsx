import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

export const badgeVariants = cva(
  "inline-flex items-center font-bold tracking-wider rounded-sm border shrink-0 whitespace-nowrap",
  {
    variants: {
      variant: {
        success: "bg-success-subtle text-success-fg border-success-border",
        warning: "bg-warning-subtle text-warning-fg border-warning-border",
        error: "bg-error-subtle text-error-fg border-error-border",
        info: "bg-info-subtle text-info-fg border-info-border",
        neutral: "bg-neutral-subtle text-neutral-fg border-neutral-border",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        md: "px-3 py-1 text-sm",
        lg: "px-4 py-1.5 text-base",
      },
    },
    defaultVariants: { variant: "neutral", size: "sm" },
  }
);

const dotColorMap: Record<string, string> = {
  success: "bg-success-strong",
  warning: "bg-warning-strong",
  error: "bg-error-strong",
  info: "bg-info-strong",
  neutral: "bg-neutral-strong",
};

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({
  className,
  variant,
  size,
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "inline-block w-1.5 h-1.5 rounded-full mr-1.5 shrink-0",
            dotColorMap[variant ?? "neutral"]
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
