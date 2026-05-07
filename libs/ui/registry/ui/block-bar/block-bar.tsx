"use client";

import {
  Children,
  isValidElement,
  useMemo,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { BlockBarContext } from "./block-bar-context.js";
import { BlockBarSegment, type SegmentVariant } from "./block-bar-segment.js";

const MAX_BAR_WIDTH = 200;

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

function getSegmentChildValue(child: ReactNode): number | null {
  if (!isValidElement(child) || child.type !== BlockBarSegment) return null;

  const segment = child as ReactElement<BlockBarSegmentData>;
  return Number.isFinite(segment.props.value)
    ? Math.max(0, segment.props.value)
    : 0;
}

function deriveValueFromSegmentChildren(children: ReactNode): number | null {
  const childArray = Children.toArray(children);
  if (childArray.length === 0) return null;

  let total = 0;
  for (const child of childArray) {
    const childValue = getSegmentChildValue(child);
    if (childValue === null) return null;
    total += childValue;
  }

  return total;
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
  const safeMax = Number.isFinite(max) ? Math.max(0, max) : 0;
  const safeBarWidth = Number.isFinite(barWidth)
    ? Math.min(MAX_BAR_WIDTH, Math.max(0, Math.floor(barWidth)))
    : 0;
  const hasChildren = children !== undefined && children !== null;
  const childValue = hasChildren ? deriveValueFromSegmentChildren(children) : null;
  if (hasChildren && value === undefined && !segments && childValue === null) {
    throw new Error("BlockBar requires `value` when custom children are not BlockBar.Segment elements.");
  }

  const rawValue =
    value ?? (segments ? segments.reduce((sum, seg) => (
      Number.isFinite(seg.value) ? sum + Math.max(0, seg.value) : sum
    ), 0) : childValue ?? 0);
  const displayValue = Number.isFinite(rawValue)
    ? Math.min(Math.max(0, rawValue), safeMax)
    : 0;
  const resolvedSegments = segments
    ? segments.map((segment) => ({
        ...segment,
        value: Number.isFinite(segment.value)
          ? Math.min(Math.max(0, segment.value), safeMax)
          : 0,
      }))
    : [{ value: displayValue, variant }];

  const contextValue = useMemo(
    () => ({ max: safeMax, barWidth: safeBarWidth, filledChar, emptyChar }),
    [safeMax, safeBarWidth, filledChar, emptyChar],
  );

  return (
    <BlockBarContext value={contextValue}>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={displayValue}
        aria-valuetext={`${displayValue} of ${safeMax}`}
        aria-label={label}
        className={cn("flex items-center font-mono text-sm", className)}
        {...props}
      >
        {(!hasChildren || segments) && label && (
          <span className="w-20 truncate text-xs text-muted-foreground">
            {label}
          </span>
        )}
        <span
          className="relative inline-block max-w-full shrink-0 overflow-hidden tracking-widest"
          style={{ width: `${safeBarWidth}ch` }}
        >
          <span className="text-border select-none" aria-hidden="true">
            {emptyChar.repeat(safeBarWidth)}
          </span>
          <span className="absolute inset-0 flex">
            {segments || !hasChildren
              ? resolvedSegments.map((seg, i) => (
                <BlockBarSegment
                  key={i}
                  value={seg.value}
                  variant={seg.variant}
                  char={seg.char}
                />
              ))
              : children}
          </span>
        </span>
        {(!hasChildren || segments) && (
          <span className="w-8 text-right font-bold">{displayValue}</span>
        )}
      </div>
    </BlockBarContext>
  );
}

export { BlockBarRoot as BlockBar };
