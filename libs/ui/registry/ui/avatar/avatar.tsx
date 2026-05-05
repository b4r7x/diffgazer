"use client";

import {
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { AvatarContext, useAvatarGroupContext, type AvatarStatus } from "./avatar-context";
import { AvatarImage } from "./avatar-image";
import { AvatarFallback } from "./avatar-fallback";

export { type AvatarStatus };

export const avatarVariants = cva(
  "relative inline-flex items-center justify-center border border-foreground/40 font-mono font-medium text-foreground bg-background overflow-hidden shrink-0",
  {
    variants: {
      size: {
        sm: "size-6 text-[10px]",
        md: "size-8 text-xs",
        lg: "size-10 text-sm",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export interface AvatarProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof avatarVariants> {
  /** Image source URL. Ignored when children are provided. */
  src?: string;
  alt?: string;
  /** Fallback content shown when image fails. Ignored when children are provided. */
  fallback?: ReactNode;
  onStatusChange?: (status: AvatarStatus) => void;
  ref?: Ref<HTMLSpanElement>;
  children?: ReactNode;
}

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
      <span
        ref={ref}
        role={label ? "img" : "presentation"}
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
