import { type HTMLAttributes, type Ref } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral";
export type BadgeSize = "sm" | "md" | "lg";

export const badgeVariants = cva(
  "inline-flex items-center font-bold tracking-wider rounded-sm border shrink-0 whitespace-nowrap",
  {
    variants: {
      variant: {
        success: "[--badge-dot:var(--color-success-strong)] bg-success-subtle text-success-fg border-success-border",
        warning: "[--badge-dot:var(--color-warning-strong)] bg-warning-subtle text-warning-fg border-warning-border",
        error: "[--badge-dot:var(--color-error-strong)] bg-error-subtle text-error-fg border-error-border",
        info: "[--badge-dot:var(--color-info-strong)] bg-info-subtle text-info-fg border-info-border",
        neutral: "[--badge-dot:var(--color-neutral-strong)] bg-neutral-subtle text-neutral-fg border-neutral-border",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        md: "px-3 py-1 text-sm",
        lg: "px-4 py-1.5 text-base",
      },
    },
    defaultVariants: { variant: "neutral", size: "sm" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    Omit<VariantProps<typeof badgeVariants>, "variant"> {
  variant?: BadgeVariant;
  dot?: boolean;
  ref?: Ref<HTMLSpanElement>;
}

export function Badge({
  ref,
  className,
  variant,
  size,
  dot,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className="mr-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[--badge-dot]"
        />
      )}
      {children}
    </span>
  );
}
