"use client";

import type { ReactNode, HTMLAttributes } from "react";
import { cva } from "class-variance-authority";
import { type CalloutVariant, useCalloutContext } from "./callout-context";
import { cn } from "@/lib/utils";

const iconVariants = cva(
  "w-5 h-5 flex items-center justify-center text-xs font-bold rounded-sm shrink-0 mt-0.5 shadow-lg",
  {
    variants: {
      variant: {
        info: "bg-info-strong text-info-strong-foreground shadow-info-strong/20",
        warning:
          "bg-warning-strong text-warning-strong-foreground shadow-warning-strong/20",
        error:
          "bg-error-strong text-error-strong-foreground shadow-error-strong/20",
        success:
          "bg-success-strong text-success-strong-foreground shadow-success-strong/20",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

const defaultIcons: Record<CalloutVariant, string> = {
  info: "i",
  warning: "!",
  error: "✕",
  success: "✓",
};

export interface CalloutIconProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export function CalloutIcon({
  children,
  className,
  ...props
}: CalloutIconProps) {
  const { variant } = useCalloutContext();

  return (
    <div
      aria-hidden="true"
      className={cn(
        iconVariants({ variant }),
        "col-start-1 row-start-1 row-span-2",
        className,
      )}
      {...props}
    >
      {children ?? defaultIcons[variant]}
    </div>
  );
}
