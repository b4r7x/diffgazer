import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

export const emptyStateVariants = cva("group/es text-muted-foreground", {
  variants: {
    variant: {
      centered: "flex flex-col items-center justify-center text-center",
      inline: "flex items-start",
    },
    size: {
      sm: "gap-2",
      md: "gap-3",
      lg: "gap-4",
    },
  },
  compoundVariants: [
    { variant: "centered", size: "sm", class: "p-3" },
    { variant: "centered", size: "md", class: "p-6" },
    { variant: "centered", size: "lg", class: "p-10" },
    { variant: "inline", size: "sm", class: "p-2" },
    { variant: "inline", size: "md", class: "p-4" },
    { variant: "inline", size: "lg", class: "p-6" },
  ],
  defaultVariants: { variant: "centered", size: "md" },
});

export type EmptyStateSize = NonNullable<VariantProps<typeof emptyStateVariants>["size"]>;
export type EmptyStateVariant = NonNullable<VariantProps<typeof emptyStateVariants>["variant"]>;

export type EmptyStateProps = ComponentPropsWithRef<"div"> & {
  variant?: EmptyStateVariant;
  size?: EmptyStateSize;
  /**
   * Adds role="status" + aria-live="polite" so screen readers announce the
   * empty state when it appears. A live EmptyState MUST stay mounted across the
   * results→empty transition: render it unconditionally (empty when results
   * exist) and swap its children, rather than conditionally mounting it already
   * containing its message — many SR/browser pairs do not announce a live region
   * inserted with content already inside it.
   */
  live?: boolean;
};

/** Root wrapper - provides size context to all parts. Variant controls root layout only. */
export function EmptyState({
  variant = "centered",
  size = "md",
  live = false,
  className,
  children,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      data-size={size}
      {...(live
        ? {
            role: "status" as const,
            "aria-live": "polite" as const,
            "aria-atomic": "true" as const,
          }
        : undefined)}
      className={cn(emptyStateVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </div>
  );
}
