"use client";

import { type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { avatarVariants } from "./avatar";
import { useAvatarGroupContext } from "./avatar-context";

export interface AvatarIndicatorProps extends VariantProps<typeof avatarVariants> {
  count: number;
  className?: string;
}

export function AvatarIndicator({ count, size, className }: AvatarIndicatorProps) {
  const groupCtx = useAvatarGroupContext();
  const resolvedSize = size ?? groupCtx?.size;
  return (
    <span
      role="img"
      aria-label={`${count} more`}
      className={cn(avatarVariants({ size: resolvedSize }), "border-dashed bg-muted text-foreground", className)}
    >
      <span aria-hidden="true">+{count}</span>
    </span>
  );
}
