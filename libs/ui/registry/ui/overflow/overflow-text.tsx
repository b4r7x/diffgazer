"use client";

import type { ComponentPropsWithRef, CSSProperties, ReactNode, Ref, SyntheticEvent } from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useOverflowDetection } from "@/hooks/use-overflow-detection";
import { cn } from "@/lib/utils";
import {
  type PopoverTriggerRenderProps,
  PopoverTrigger as TooltipTrigger,
} from "../popover/popover-trigger";
import { TooltipRoot as Tooltip } from "../tooltip/tooltip";
import { TooltipContent } from "../tooltip/tooltip-content";

function resolveTooltipContent(
  tooltip: ReactNode | boolean | undefined,
  children: string,
): ReactNode | null {
  if (tooltip === false) return null;
  if (tooltip != null && tooltip !== true) return tooltip;
  return children;
}

export interface OverflowTextProps extends Omit<ComponentPropsWithRef<"div">, "children"> {
  /** String to clamp (text mode) or items to measure (items mode). */
  children: string;
  /** Text mode only. 1 truncates; 2+ uses CSS line-clamp. */
  lines?: number;
  /**
   * Text mode only. true/ReactNode renders a Tooltip when content is actually clipped
   * (auto-derived from children when true). false disables the tooltip.
   */
  tooltip?: ReactNode | boolean;
}

function clampStyle(lines: number): CSSProperties | undefined {
  if (lines <= 1) return undefined;
  return {
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };
}

type PassiveOverflowTriggerProps = Pick<
  PopoverTriggerRenderProps,
  | "ref"
  | "className"
  | "aria-describedby"
  | "onPointerDown"
  | "onMouseEnter"
  | "onMouseLeave"
  | "onFocus"
  | "onBlur"
  | "tabIndex"
>;

interface OverflowTextContentProps extends Omit<ComponentPropsWithRef<"div">, "children"> {
  /** The string being clamped. */
  children: string;
  /** Resolved clamp count. 1 truncates; 2+ uses CSS line-clamp. */
  lines: number;
  /** Inline styles applied to the rendered element. */
  style: CSSProperties | undefined;
}

function OverflowTextContent({
  children,
  lines,
  className,
  style,
  ref,
  ...props
}: OverflowTextContentProps) {
  return (
    <div
      ref={ref}
      data-slot="overflow"
      className={cn(lines === 1 && "truncate", className)}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

interface OverflowTooltipTriggerProps extends PassiveOverflowTriggerProps {
  /** Ref for the container element. */
  containerRef: Ref<HTMLDivElement>;
  /** Resolved clamp count. 1 truncates; 2+ uses CSS line-clamp. */
  lines: number;
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** Inline styles applied to the rendered element. */
  style: CSSProperties | undefined;
  /** Props forwarded to the container element. */
  containerProps: Omit<ComponentPropsWithRef<"div">, "children">;
  /** The string being clamped. */
  children: string;
}

/** Consumer handler first; a prevented consumer event stops the tooltip's own handler. */
function composeHandlers<E extends SyntheticEvent>(
  consumer: ((event: E) => void) | undefined,
  trigger: ((event: E) => void) | undefined,
): ((event: E) => void) | undefined {
  if (!consumer) return trigger;
  if (!trigger) return consumer;
  return (event) => {
    consumer(event);
    if (!event.defaultPrevented) trigger(event);
  };
}

function OverflowTooltipTrigger({
  ref: triggerRef,
  className: triggerClassName,
  "aria-describedby": triggerDescribedBy,
  tabIndex: triggerTabIndex,
  containerRef,
  lines,
  className,
  style,
  containerProps,
  children,
  onPointerDown,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
}: OverflowTooltipTriggerProps) {
  const composedRef = useComposedRefs(containerRef, triggerRef);
  // Merge rather than let the trigger's props win: these five events, the
  // description and the tab stop are the only things the tooltip claims, and a
  // consumer that passes them to Overflow gets them honoured in the non-tooltip
  // branch too. The tooltip owns the tab stop while it is enabled — that is the
  // only keyboard path to it — and hands the consumer value back when it is not.
  const {
    onPointerDown: consumerPointerDown,
    onMouseEnter: consumerMouseEnter,
    onMouseLeave: consumerMouseLeave,
    onFocus: consumerFocus,
    onBlur: consumerBlur,
    "aria-describedby": consumerDescribedBy,
    tabIndex: consumerTabIndex,
    ...restContainer
  } = containerProps;
  const composedHandlers = {
    onPointerDown: composeHandlers(consumerPointerDown, onPointerDown),
    onMouseEnter: composeHandlers(consumerMouseEnter, onMouseEnter),
    onMouseLeave: composeHandlers(consumerMouseLeave, onMouseLeave),
    onFocus: composeHandlers(consumerFocus, onFocus),
    onBlur: composeHandlers(consumerBlur, onBlur),
  };
  const describedBy =
    [consumerDescribedBy, triggerDescribedBy].filter(Boolean).join(" ") || undefined;

  return (
    <div
      ref={composedRef}
      data-slot="overflow"
      className={cn(lines === 1 && "truncate", className, triggerClassName)}
      {...restContainer}
      {...composedHandlers}
      aria-describedby={describedBy}
      tabIndex={triggerTabIndex ?? consumerTabIndex}
      style={style}
    >
      {children}
    </div>
  );
}

function mergeClampStyle(
  lines: number,
  consumerStyle: CSSProperties | undefined,
): CSSProperties | undefined {
  const clamped = clampStyle(lines);
  if (!clamped && !consumerStyle) return undefined;
  return { ...clamped, ...consumerStyle };
}

interface OverflowTooltipTextProps extends Omit<OverflowTextProps, "tooltip" | "style" | "lines"> {
  /** Tooltip content resolved from the public tooltip prop. */
  resolvedTooltip: ReactNode;
  /** Resolved clamp count. 1 truncates; 2+ uses CSS line-clamp. */
  lines: number;
  /** Inline styles applied to the rendered element. */
  style: CSSProperties | undefined;
}

function OverflowTooltipText({
  children,
  lines,
  resolvedTooltip,
  className,
  style,
  ref: forwardedRef,
  ...props
}: OverflowTooltipTextProps) {
  const { ref, isOverflowing } = useOverflowDetection<HTMLDivElement>(
    lines > 1 ? "vertical" : "horizontal",
  );
  const composedRef = useComposedRefs(ref, forwardedRef);
  return (
    <Tooltip enabled={isOverflowing}>
      <TooltipTrigger>
        {(triggerProps: PopoverTriggerRenderProps) => {
          const passiveTriggerProps = {
            ref: triggerProps.ref,
            className: triggerProps.className,
            "aria-describedby": triggerProps["aria-describedby"],
            onPointerDown: triggerProps.onPointerDown,
            onMouseEnter: triggerProps.onMouseEnter,
            onMouseLeave: triggerProps.onMouseLeave,
            onFocus: triggerProps.onFocus,
            onBlur: triggerProps.onBlur,
            tabIndex: triggerProps.tabIndex,
          } satisfies PassiveOverflowTriggerProps;

          return (
            <OverflowTooltipTrigger
              {...passiveTriggerProps}
              containerRef={composedRef}
              lines={lines}
              className={className}
              style={style}
              containerProps={props}
            >
              {children}
            </OverflowTooltipTrigger>
          );
        }}
      </TooltipTrigger>
      <TooltipContent>{resolvedTooltip}</TooltipContent>
    </Tooltip>
  );
}

export function OverflowText({
  children,
  lines = 1,
  tooltip,
  className,
  style: consumerStyle,
  ref,
  ...props
}: OverflowTextProps) {
  const resolvedTooltip = resolveTooltipContent(tooltip, children);
  const style = mergeClampStyle(lines, consumerStyle);

  if (resolvedTooltip == null) {
    return (
      <OverflowTextContent {...props} ref={ref} lines={lines} className={className} style={style}>
        {children}
      </OverflowTextContent>
    );
  }

  return (
    <OverflowTooltipText
      {...props}
      ref={ref}
      lines={lines}
      className={className}
      style={style}
      resolvedTooltip={resolvedTooltip}
    >
      {children}
    </OverflowTooltipText>
  );
}
