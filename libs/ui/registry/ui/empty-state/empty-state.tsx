"use client";

import { useState, useEffect, type ComponentPropsWithRef } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

export type EmptyStateSize = "sm" | "md" | "lg";
export type EmptyStateVariant = "centered" | "inline";

export const emptyStateVariants = cva("group/es text-muted-foreground", {
  variants: {
    variant: {
      centered: "flex flex-col items-center justify-center text-center",
      inline: "flex items-start",
    },
    size: {
      sm: "",
      md: "",
      lg: "",
    },
  },
  compoundVariants: [
    { variant: "centered", size: "sm", class: "gap-2 p-3" },
    { variant: "centered", size: "md", class: "gap-3 p-6" },
    { variant: "centered", size: "lg", class: "gap-4 p-10" },
    { variant: "inline", size: "sm", class: "gap-2 p-2" },
    { variant: "inline", size: "md", class: "gap-3 p-4" },
    { variant: "inline", size: "lg", class: "gap-4 p-6" },
  ],
  defaultVariants: { variant: "centered", size: "md" },
});

export type EmptyStateProps = ComponentPropsWithRef<"div"> & {
  variant?: EmptyStateVariant;
  size?: EmptyStateSize;
  /** When true, adds role="status" and aria-live="polite" so screen readers announce dynamic empty states. */
  live?: boolean;
};

export function EmptyState({ variant = "centered", size = "md", live = false, className, children, ...props }: EmptyStateProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div
      data-size={size}
      {...(live ? { role: "status" as const, "aria-live": "polite" as const } : undefined)}
      className={cn(emptyStateVariants({ variant, size }), className)}
      {...props}
    >
      {live ? (mounted ? children : null) : children}
    </div>
  );
}
