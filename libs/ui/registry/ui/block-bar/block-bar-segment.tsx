"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import {
  useBlockBarContext,
  computeFilledCount,
} from "./block-bar-context.js";

const segmentVariants = cva("", {
  variants: {
    variant: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      error: "text-error-fg",
      warning: "text-warning-fg",
      success: "text-success-fg",
      info: "text-info-fg",
    },
  },
  defaultVariants: { variant: "default" },
});

export type SegmentVariant = NonNullable<
  VariantProps<typeof segmentVariants>["variant"]
>;

export interface BlockBarSegmentProps
  extends VariantProps<typeof segmentVariants>,
    Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  value: number;
  char?: string;
  children?: ReactNode;
}

export function BlockBarSegment({
  value,
  variant,
  char,
  className,
  children,
  ...props
}: BlockBarSegmentProps) {
  const { max, barWidth, filledChar } = useBlockBarContext();
  const chars = computeFilledCount(value, max, barWidth);
  const displayChar = char ?? filledChar;

  return (
    <span
      aria-hidden="true"
      className={cn(segmentVariants({ variant }), className)}
      {...props}
    >
      {displayChar.repeat(chars)}
      {children}
    </span>
  );
}
