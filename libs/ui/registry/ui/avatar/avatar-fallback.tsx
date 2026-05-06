"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAvatarContext } from "./avatar-context";
import { useImageStatus } from "./use-image-status";

export interface AvatarFallbackProps {
  /** Cascading fallback image URL. Tried before rendering children. */
  src?: string;
  children?: ReactNode;
  className?: string;
}

export function AvatarFallback({
  src,
  children,
  className,
}: AvatarFallbackProps) {
  const { imageStatus } = useAvatarContext();
  const fallbackImage = useImageStatus(src);

  if (imageStatus === "loaded") return null;
  if (src && fallbackImage.showImage) {
    return (
      <img
        src={src}
        alt=""
        onLoad={fallbackImage.onLoad}
        onError={fallbackImage.onError}
        className={cn("absolute inset-0 size-full object-cover", className)}
      />
    );
  }

  return <span className={className}>{children}</span>;
}
