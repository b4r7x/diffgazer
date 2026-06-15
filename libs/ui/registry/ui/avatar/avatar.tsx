"use client";

import { cva, type VariantProps } from "class-variance-authority";
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { AvatarContext, type AvatarStatus, useAvatarGroupContext } from "./avatar-context";
import { AvatarFallback } from "./avatar-fallback";
import { AvatarImage } from "./avatar-image";

export type { AvatarStatus };

/** Class variants for avatar. */
export const avatarVariants = cva(
  "relative inline-flex items-center justify-center border border-foreground/40 font-mono font-medium text-foreground bg-background overflow-hidden shrink-0",
  {
    variants: {
      size: {
        sm: "size-6 text-2xs",
        md: "size-8 text-xs",
        lg: "size-10 text-sm",
      },
    },
    defaultVariants: { size: "md" },
  },
);

/** Props for avatar. */
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
  onStatusChange?: (status: AvatarStatus) => void;
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
  const [imageStatus, setImageStatus] = useState<AvatarStatus>("idle");
  const notifyStatusChange = useEffectEvent((status: AvatarStatus) => {
    onStatusChange?.(status);
  });

  useEffect(() => {
    if (imageStatus === "idle") return;
    notifyStatusChange(imageStatus);
  }, [imageStatus]);

  const contextValue = useMemo(() => ({ imageStatus, setImageStatus }), [imageStatus]);

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
            <AvatarFallback>{fallback ?? "?"}</AvatarFallback>
          </>
        )}
      </span>
    </AvatarContext>
  );
}

export { AvatarRoot as Avatar };
