import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Allowed badge variant values. */
export type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral";
/** Allowed badge size values. */
export type BadgeSize = "sm" | "md" | "lg";

/** Class variants for badge. */
export const badgeVariants = cva(
  "inline-flex items-center font-bold tracking-wider rounded-sm border shrink-0 whitespace-nowrap",
  {
    variants: {
      variant: {
        success:
          "[--badge-dot:var(--success-strong)] bg-success-subtle text-success-text border-success-border",
        warning:
          "[--badge-dot:var(--warning-strong)] bg-warning-subtle text-warning-text border-warning-border",
        error:
          "[--badge-dot:var(--error-strong)] bg-error-subtle text-error-text border-error-border",
        info: "[--badge-dot:var(--info-strong)] bg-info-subtle text-info-text border-info-border",
        neutral:
          "[--badge-dot:var(--neutral-strong)] bg-neutral-subtle text-neutral-text border-neutral-border",
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

/** Props for badge. */
export interface BadgeProps
  extends ComponentProps<"span">,
    Omit<VariantProps<typeof badgeVariants>, "variant"> {
  /** Semantic color token. Picks foreground, background, border, and dot color together. */
  variant?: BadgeVariant;
  /** Renders a leading status dot in the variant color. */
  dot?: boolean;
}

/** Root label container with variant and size styling. */
export function Badge({ ref, className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <span
      ref={ref}
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className="mr-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-(--badge-dot)"
        />
      )}
      {children}
    </span>
  );
}
