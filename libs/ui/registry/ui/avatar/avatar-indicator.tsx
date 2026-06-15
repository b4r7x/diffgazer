"use client";

import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { avatarVariants } from "./avatar";
import { useAvatarGroupContext } from "./avatar-context";

/** Props for avatar indicator. */
export interface AvatarIndicatorProps
  extends Omit<ComponentProps<"span">, "role">,
    VariantProps<typeof avatarVariants> {
  /** Number rendered as "+N". Used by AvatarGroup for overflow but available standalone. */
  count: number;
  /** Accessible name for the "+N" overflow indicator. Defaults to `${count} more`. */
  getLabel?: (count: number) => string;
}

/** Overflow count badge (+N). Auto-rendered by AvatarGroup, or usable standalone. */
export function AvatarIndicator({
  count,
  size,
  className,
  "aria-label": ariaLabel,
  getLabel,
  ...props
}: AvatarIndicatorProps) {
  const groupCtx = useAvatarGroupContext();
  const resolvedSize = size ?? groupCtx?.size;
  return (
    <span
      {...props}
      role="img"
      aria-label={ariaLabel ?? getLabel?.(count) ?? `${count} more`}
      className={cn(
        avatarVariants({ size: resolvedSize }),
        "border-dashed bg-muted text-foreground",
        className,
      )}
    >
      <span aria-hidden="true">+{count}</span>
    </span>
  );
}
