"use client";

import { useMemo, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BlockBarContext } from "./block-bar-context.js";
import { BlockBarSegment, type SegmentVariant } from "./block-bar-segment.js";

export interface BlockBarSegmentData {
  value: number;
  variant?: SegmentVariant;
  char?: string;
}

export interface BlockBarProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
  max: number;
  barWidth?: number;
  filledChar?: string;
  emptyChar?: string;
  label?: string;
  variant?: SegmentVariant;
  segments?: BlockBarSegmentData[];
  children?: ReactNode;
}

function BlockBarRoot({
  value,
  max,
  barWidth = 20,
  filledChar = "\u2588",
  emptyChar = "\u2591",
  label,
  variant,
  segments,
  className,
  children,
  ...props
}: BlockBarProps) {
  const displayValue =
    value ?? (segments ? segments.reduce((s, seg) => s + seg.value, 0) : 0);
  const resolvedSegments = segments ?? [{ value: displayValue, variant }];

  const contextValue = useMemo(() => ({ max, barWidth, filledChar, emptyChar }), [max, barWidth, filledChar, emptyChar]);

  return (
    <BlockBarContext value={contextValue}>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={displayValue}
        aria-valuetext={`${displayValue} of ${max}`}
        aria-label={!children ? label : undefined}
        className={cn("flex items-center font-mono text-sm", className)}
        {...props}
      >
        {!children && label && (
          <span className="w-20 truncate text-xs text-muted-foreground">
            {label}
          </span>
        )}
        <span className="relative flex-1 overflow-hidden tracking-widest">
          <span className="text-border select-none" aria-hidden="true">
            {emptyChar.repeat(barWidth)}
          </span>
          <span className="absolute inset-0 flex">
            {children ??
              resolvedSegments.map((seg, i) => (
                <BlockBarSegment
                  key={i}
                  value={seg.value}
                  variant={seg.variant}
                  char={seg.char}
                />
              ))}
          </span>
        </span>
        {!children && (
          <span className="w-8 text-right font-bold">{displayValue}</span>
        )}
      </div>
    </BlockBarContext>
  );
}

export { BlockBarRoot as BlockBar };
