"use client";

import { cn } from "@/lib/utils";
import { PopoverContent, type PopoverContentProps } from "../popover/popover-content";

export interface TooltipContentProps extends Omit<PopoverContentProps, "autoFocus" | "role"> {}

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
      // The anchored overlay tier (border, --surface-1 fill, highlight lip,
      // radius) comes from PopoverContent; the tooltip only adds its own width,
      // padding, and type. No drop shadow — that is the modal tier's mark.
      className={cn("max-w-xs px-2 py-1 font-mono text-xs text-foreground", className)}
      {...rest}
    >
      {children}
    </PopoverContent>
  );
}
