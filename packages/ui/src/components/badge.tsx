import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

export const badgeVariants = cva(
  "inline-flex items-center font-bold tracking-wider rounded-sm border shrink-0 whitespace-nowrap",
  {
    variants: {
      variant: {
        success: "bg-tui-green/10 text-tui-green border-tui-green",
        warning: "bg-tui-yellow/10 text-tui-yellow border-tui-yellow",
        error: "bg-tui-red/10 text-tui-red border-tui-red",
        info: "bg-tui-blue/10 text-tui-blue border-tui-blue",
        neutral: "bg-tui-muted/10 text-tui-muted border-tui-border",
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
  success: "bg-tui-green",
  warning: "bg-tui-yellow",
  error: "bg-tui-red",
  info: "bg-tui-blue",
  neutral: "bg-tui-muted",
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
