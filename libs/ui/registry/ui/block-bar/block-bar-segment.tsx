"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { computeFilledCount, useBlockBarContext } from "./block-bar-context";

const segmentVariants = cva("", {
  variants: {
    variant: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      error: "text-error-text",
      warning: "text-warning-text",
      success: "text-success-text",
      info: "text-info-text",
    },
  },
  defaultVariants: { variant: "default" },
});

/** Allowed segment variant values. */
export type SegmentVariant = NonNullable<VariantProps<typeof segmentVariants>["variant"]>;

/** Props for block bar segment. */
export interface BlockBarSegmentProps
  extends VariantProps<typeof segmentVariants>,
    Omit<ComponentProps<"span">, "children"> {
  /** Segment value in the same units as BlockBar max. */
  value: number;
  /** Override the filled character for this segment only. */
  char?: string;
  /** Optional content rendered after the segment glyphs (e.g. a label or icon). */
  children?: ReactNode;
}

/** Customizable colored segment with optional children content. */
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
    <span aria-hidden="true" className={cn(segmentVariants({ variant }), className)} {...props}>
      {displayChar.repeat(chars)}
      {children}
    </span>
  );
}
