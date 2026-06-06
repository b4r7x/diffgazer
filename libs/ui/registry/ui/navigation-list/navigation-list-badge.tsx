"use client";

import { cn } from "@/lib/utils";
import { Badge, type BadgeProps } from "../badge/badge";

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
        "group-data-[active]:bg-primary-foreground/15 group-data-[active]:text-primary-foreground group-data-[active]:border-primary-foreground/40",
        className
      )}
      {...props}
    >
      {children}
    </Badge>
  );
}
