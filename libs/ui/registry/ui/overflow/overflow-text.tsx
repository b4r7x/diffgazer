"use client";

import type { ComponentPropsWithRef, CSSProperties, ReactNode, Ref } from "react";
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

/** Props for overflow text. */
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

/** Props for overflow tooltip trigger. */
interface OverflowTooltipTriggerProps extends PassiveOverflowTriggerProps {
  /** Ref for the container element. */
  containerRef: Ref<HTMLDivElement>;
  /** Text mode only. 1 truncates; 2+ uses CSS line-clamp. */
  lines: number;
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** Inline styles applied to the rendered element. */
  style: CSSProperties | undefined;
  /** Props forwarded to the container element. */
  containerProps: Omit<ComponentPropsWithRef<"div">, "children">;
  /** String to clamp (text mode) or items to measure (items mode). */
  children: string;
}

function OverflowTooltipTrigger({
  ref: triggerRef,
  className: triggerClassName,
  containerRef,
  lines,
  className,
  style,
  containerProps,
  children,
  ...restTrigger
}: OverflowTooltipTriggerProps) {
  const composedRef = useComposedRefs(containerRef, triggerRef);
  return (
    <div
      ref={composedRef}
      data-slot="overflow"
      className={cn(lines === 1 && "truncate", className, triggerClassName)}
      style={style}
      {...containerProps}
      {...restTrigger}
    >
      {children}
    </div>
  );
}

export function OverflowText({
  children,
  lines = 1,
  tooltip,
  className,
  ref: forwardedRef,
  ...props
}: OverflowTextProps) {
  const { ref, isOverflowing } = useOverflowDetection<HTMLDivElement>(
    lines > 1 ? "vertical" : "horizontal",
  );
  const composedRef = useComposedRefs(ref, forwardedRef);

  const resolvedTooltip = resolveTooltipContent(tooltip, children);
  const style = clampStyle(lines);
  const content = (
    <div
      ref={composedRef}
      data-slot="overflow"
      className={cn(lines === 1 && "truncate", className)}
      style={style}
      {...props}
    >
      {children}
    </div>
  );

  if (resolvedTooltip != null) {
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

  return content;
}
