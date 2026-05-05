"use client";

import { cn } from "@/lib/utils";
import { PopoverContent, type PopoverContentProps } from "../popover/popover-content";

export interface TooltipContentProps extends Omit<PopoverContentProps, "autoFocus"> {}

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
