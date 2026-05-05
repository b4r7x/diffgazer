"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { composeRefs } from "@/lib/compose-refs";
import { useOverflow } from "@/hooks/use-overflow";
import { TooltipRoot as Tooltip } from "../tooltip/tooltip";
import { TooltipContent } from "../tooltip/tooltip-content";
import { PopoverTrigger as TooltipTrigger } from "../popover/popover-trigger";

function resolveTooltipContent(
  tooltip: ReactNode | boolean | undefined,
  children: string,
): ReactNode | null {
  if (tooltip === false) return null;
  if (tooltip != null && tooltip !== true) return tooltip;
  return children;
}

export interface OverflowTextProps {
  children: string;
  lines?: number;
  tooltip?: ReactNode | boolean;
  className?: string;
}

function clampStyle(lines: number): React.CSSProperties | undefined {
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
}: OverflowTextProps) {
  const { ref, isOverflowing } = useOverflow<HTMLDivElement>(lines > 1 ? "vertical" : "horizontal");

  const resolvedTooltip = resolveTooltipContent(tooltip, children);
  const style = clampStyle(lines);

  if (resolvedTooltip != null) {
    return (
      <Tooltip enabled={isOverflowing}>
        <TooltipTrigger>
          {({ ref: triggerRef, className: triggerCn, ...restTrigger }) => (
            <div
              ref={composeRefs(ref, triggerRef)}
              className={cn(lines === 1 && "truncate", className, triggerCn)}
              style={style}
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

  return (
    <div
      ref={ref}
      className={cn(lines === 1 && "truncate", className)}
      style={style}
    >
      {children}
    </div>
  );
}
