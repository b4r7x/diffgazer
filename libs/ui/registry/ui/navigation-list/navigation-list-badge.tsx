"use client";

import { Badge, type BadgeProps } from "../badge/badge";
import { cn } from "@/lib/utils";

export function NavigationListBadge({
  children,
  variant = "neutral",
  size = "sm",
  className,
  ...props
}: BadgeProps) {
  return (
    <Badge
      variant={variant}
      size={size}
      className={cn(
        "group-data-[active]:bg-background group-data-[active]:text-foreground group-data-[active]:border-foreground",
        className
      )}
      {...props}
    >
      {children}
    </Badge>
  );
}
