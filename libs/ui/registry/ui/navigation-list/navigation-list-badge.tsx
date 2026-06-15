"use client";

import { cn } from "@/lib/utils";
import { Badge, type BadgeProps } from "../badge/badge";

/** Standardized badge slot (uses Badge primitive) */
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
        "group-data-[highlighted]:bg-primary-foreground/15 group-data-[highlighted]:text-primary-foreground group-data-[highlighted]:border-primary-foreground/40",
        className,
      )}
      {...props}
    >
      {children}
    </Badge>
  );
}
