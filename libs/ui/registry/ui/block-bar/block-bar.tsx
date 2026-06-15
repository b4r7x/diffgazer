"use client";

import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useMemo,
} from "react";
import { cn } from "@/lib/utils";
import { BlockBarContext } from "./block-bar-context";
import { BlockBarSegment, type SegmentVariant } from "./block-bar-segment";

const MAX_BAR_WIDTH = 200;

/** Customizable colored segment with optional children content. */
export interface BlockBarSegmentData {
  /** Segment value in the same units as BlockBar max. */
  value: number;
  /** Segment color token. */
  variant?: SegmentVariant;
  /** Override the filled character for this segment only. */
  char?: string;
}

/** Props for block bar. */
export interface BlockBarProps
  extends Omit<
    ComponentProps<"div">,
    | "aria-label"
    | "aria-labelledby"
    | "aria-valuemax"
    | "aria-valuemin"
    | "aria-valuenow"
    | "aria-valuetext"
    | "role"
  > {
  /**
   * Current value. Required unless segments are provided or BlockBar.Segment children are
   * passed (in which case the value is derived from their sum).
   */
  value?: number;
  /** Maximum value the bar represents. Used for aria-valuemax and fill ratio. */
  max: number;
  /** Width of the bar in character cells. Clamped to 0-200. */
  barWidth?: number;
  /** Character used for the filled portion of the bar. */
  filledChar?: string;
  /** Character used for the empty portion of the bar. */
  emptyChar?: string;
  /**
   * Visible label rendered to the left of the bar in simple mode. Also used as accessible name
   * when aria-label is omitted.
   */
  label?: string;
  /**
   * Accessible name. When set (or label is set), the bar exposes role="meter" with
   * aria-valuemin/max/now/text.
   */
  "aria-label"?: string;
  /** ID of an element labelling the bar. Alternative to aria-label. */
  "aria-labelledby"?: string;
  /** Override for aria-valuetext. */
  valueText?: string;
  /**
   * Color token applied to the implicit single segment when no segments or children are
   * provided.
   */
  variant?: SegmentVariant;
  /**
   * Multi-segment stack. When provided, takes precedence over children and derives value from
   * the sum.
   */
  segments?: BlockBarSegmentData[];
  /**
   * BlockBar.Segment children for fully custom rendering. Throws when neither value nor
   * segments are provided and children are not BlockBar.Segment elements.
   */
  children?: ReactNode;
}

function getSegmentChildValue(child: ReactNode): number | null {
  if (!isValidElement(child) || child.type !== BlockBarSegment) return null;

  const segment = child as ReactElement<BlockBarSegmentData>;
  return Number.isFinite(segment.props.value) ? Math.max(0, segment.props.value) : 0;
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

/** Root meter element with ARIA attributes. */
function BlockBarRoot({
  value,
  max,
  barWidth = 20,
  filledChar = "\u2588",
  emptyChar = "\u2591",
  label,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  valueText,
  variant,
  segments,
  className,
  children,
  ...props
}: BlockBarProps) {
  const resolvedAriaLabel = ariaLabel ?? label;
  const hasAccessibleName = Boolean(resolvedAriaLabel || ariaLabelledBy);
  const safeMax = Number.isFinite(max) ? Math.max(0, max) : 0;
  const safeBarWidth = Number.isFinite(barWidth)
    ? Math.min(MAX_BAR_WIDTH, Math.max(0, Math.floor(barWidth)))
    : 0;
  const hasChildren = children !== undefined && children !== null;
  const childValue = hasChildren ? deriveValueFromSegmentChildren(children) : null;
  if (hasChildren && value === undefined && !segments && childValue === null) {
    throw new Error(
      "BlockBar requires `value` when custom children are not BlockBar.Segment elements.",
    );
  }

  const rawValue =
    value ??
    (segments
      ? segments.reduce(
          (sum, seg) => (Number.isFinite(seg.value) ? sum + Math.max(0, seg.value) : sum),
          0,
        )
      : (childValue ?? 0));
  const displayValue = Number.isFinite(rawValue) ? Math.min(Math.max(0, rawValue), safeMax) : 0;
  const resolvedValueText = valueText ?? `${displayValue} of ${safeMax}`;
  const resolvedSegments = segments
    ? segments.map((segment) => ({
        ...segment,
        value: Number.isFinite(segment.value) ? Math.min(Math.max(0, segment.value), safeMax) : 0,
      }))
    : [{ value: displayValue, variant }];

  const contextValue = useMemo(
    () => ({ max: safeMax, barWidth: safeBarWidth, filledChar, emptyChar }),
    [safeMax, safeBarWidth, filledChar, emptyChar],
  );

  return (
    <BlockBarContext value={contextValue}>
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is conditionally "meter" (Biome cannot resolve the ternary); all aria-value* props are applied in the same branch and are valid for the meter role. */}
      <div
        {...props}
        role={hasAccessibleName ? "meter" : undefined}
        data-slot="block-bar"
        aria-valuemin={hasAccessibleName ? 0 : undefined}
        aria-valuemax={hasAccessibleName ? safeMax : undefined}
        aria-valuenow={hasAccessibleName ? displayValue : undefined}
        aria-valuetext={hasAccessibleName ? resolvedValueText : undefined}
        aria-label={hasAccessibleName ? resolvedAriaLabel : undefined}
        aria-labelledby={hasAccessibleName ? ariaLabelledBy : undefined}
        className={cn("flex items-center font-mono text-sm", className)}
      >
        {(!hasChildren || segments) && label && (
          <span className="w-20 truncate text-xs text-muted-foreground">{label}</span>
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
                    // biome-ignore lint/suspicious/noArrayIndexKey: bar segments render in fixed left-to-right order and are never reordered; segments have no stable id, so the index is the identity.
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
