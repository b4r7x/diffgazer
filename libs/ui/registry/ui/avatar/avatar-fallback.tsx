"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAvatarContext } from "./avatar-context";
import { useImageStatus } from "./use-image-status";

export interface AvatarFallbackProps {
  /** Cascading fallback image. Tried before rendering children. */
  src?: string;
  /** Initials or icon shown when no fallback image is available. */
  children?: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** Hide fallback text from assistive tech when the avatar is presentational. */
  decorative?: boolean;
}

export function AvatarFallback({ src, children, className, decorative }: AvatarFallbackProps) {
  const { imageStatus } = useAvatarContext();
  const fallbackImage = useImageStatus(src);

  if (imageStatus === "loaded") return null;
  if (fallbackImage.showImage) {
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

  return (
    <span className={className} aria-hidden={decorative ? true : undefined}>
      {children}
    </span>
  );
}
