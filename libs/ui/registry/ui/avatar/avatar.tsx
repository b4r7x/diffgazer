"use client";

import type { VariantProps } from "class-variance-authority";
import {
  type ComponentProps,
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { AvatarContext, type AvatarStatus, useAvatarGroupContext } from "./avatar-context";
import { AvatarFallback } from "./avatar-fallback";
import { AvatarImage } from "./avatar-image";
import { type AvatarSize, avatarVariants } from "./avatar-variants";

export type { AvatarStatus };
export { avatarVariants };
export type { AvatarSize };

export interface AvatarProps extends ComponentProps<"span">, VariantProps<typeof avatarVariants> {
  /** Image URL. Ignored when children are provided. */
  src?: string;
  /**
   * Image alt text and accessible name. When omitted, falls back to a string `fallback`. When
   * neither is set, the avatar uses role="presentation".
   */
  alt?: string;
  /** Shown when the image is loading, missing, or fails. */
  fallback?: ReactNode;
  /** Fired when the image load status changes. Fires for the active image only. */
  onStatusChange?: (status: Exclude<AvatarStatus, "idle">) => void;
  /** Custom inner content. Replaces the default AvatarImage + AvatarFallback composition. */
  children?: ReactNode;
}

/** Square avatar with src/fallback/size. Shows image or monospace initials. */
function AvatarRoot({
  src,
  alt,
  fallback,
  size,
  className,
  ref,
  onStatusChange,
  children,
  ...props
}: AvatarProps) {
  const groupCtx = useAvatarGroupContext();
  const resolvedSize = size ?? groupCtx?.size;
  const [imageStatus, setStatus] = useState<AvatarStatus>("idle");
  // Latest-ref sync: setImageStatus is published on context and called from child
  // DOM event handlers, where useEffectEvent is forbidden; runs every render by design.
  const latestOnStatusChange = useRef(onStatusChange);
  useLayoutEffect(() => {
    latestOnStatusChange.current = onStatusChange;
  });

  const contextValue = useMemo(
    () => ({
      imageStatus,
      setImageStatus: (status: AvatarStatus) => {
        setStatus(status);
        if (status !== "idle") latestOnStatusChange.current?.(status);
      },
    }),
    [imageStatus],
  );

  const label = alt ?? (typeof fallback === "string" ? fallback : undefined);

  return (
    <AvatarContext value={contextValue}>
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is conditionally "img" (Biome cannot resolve the ternary); aria-label is set in the same branch and is valid for the img role. */}
      <span
        ref={ref}
        role={label ? "img" : "presentation"}
        data-slot="avatar"
        aria-label={label || undefined}
        className={cn(avatarVariants({ size: resolvedSize }), className)}
        {...props}
      >
        {children ?? (
          <>
            {src && <AvatarImage src={src} />}
            <AvatarFallback decorative={!label}>{fallback ?? "?"}</AvatarFallback>
          </>
        )}
      </span>
    </AvatarContext>
  );
}

export { AvatarRoot as Avatar };
