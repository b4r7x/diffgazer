"use client";

import { cn } from "@/lib/utils";
import { PopoverContent, type PopoverContentProps } from "../popover/popover-content";

/** Props for tooltip content. */
export interface TooltipContentProps extends Omit<PopoverContentProps, "autoFocus"> {}

/** Portal-rendered positioned content. */
export function TooltipContent({
  children,
  side = "top",
  align = "center",
  sideOffset = 4,
  className,
  ...rest
}: TooltipContentProps) {
  return (
    <PopoverContent
      side={side}
      align={align}
      sideOffset={sideOffset}
      data-slot="tooltip-content"
      className={cn(
        "max-w-xs border border-border bg-background px-2 py-1 font-mono text-xs text-foreground shadow-md",
        className,
      )}
      {...rest}
    >
      {children}
    </PopoverContent>
  );
}
