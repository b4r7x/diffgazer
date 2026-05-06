"use client";

import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { composeRefs } from "@/lib/compose-refs";
import { useOverflow } from "@/hooks/use-overflow";
import { TooltipRoot as Tooltip } from "../tooltip/tooltip";
import { TooltipContent } from "../tooltip/tooltip-content";
import {
  PopoverTrigger as TooltipTrigger,
  type PopoverTriggerRenderProps,
} from "../popover/popover-trigger";

function resolveTooltipContent(
  tooltip: ReactNode | boolean | undefined,
  children: string,
): ReactNode | null {
  if (tooltip === false) return null;
  if (tooltip != null && tooltip !== true) return tooltip;
  return children;
}

export interface OverflowTextProps
  extends Omit<ComponentPropsWithRef<"div">, "children"> {
  children: string;
  lines?: number;
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

export function OverflowText({
  children,
  lines = 1,
  tooltip,
  className,
  ref: forwardedRef,
  ...props
}: OverflowTextProps) {
  const { ref, isOverflowing } = useOverflow<HTMLDivElement>(lines > 1 ? "vertical" : "horizontal");

  const resolvedTooltip = resolveTooltipContent(tooltip, children);
  const style = clampStyle(lines);
  const content = (
    <div
      ref={composeRefs(ref, forwardedRef)}
      className={cn(lines === 1 && "truncate", className)}
      style={style}
      {...props}
    >
      {children}
    </div>
  );

  if (resolvedTooltip != null && !isOverflowing) {
    return content;
  }

  if (resolvedTooltip != null) {
    return (
      <Tooltip enabled={isOverflowing}>
        <TooltipTrigger>
          {({ ref: triggerRef, className: triggerCn, role, ...restTrigger }: PopoverTriggerRenderProps) => (
            <div
              ref={composeRefs(ref, forwardedRef, triggerRef)}
              role={role}
              className={cn(lines === 1 && "truncate", className, triggerCn)}
              style={style}
              {...props}
              {...restTrigger}
            >
              {children}
            </div>
          )}
        </TooltipTrigger>
        <TooltipContent>{resolvedTooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
