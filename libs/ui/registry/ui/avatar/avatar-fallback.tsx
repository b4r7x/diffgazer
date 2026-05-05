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

function CascadingImage({ src, className }: { src: string; className?: string }) {
  const { showImage, onLoad, onError } = useImageStatus(src);
  if (!showImage) return null;
  return (
    <img
      src={src}
      alt=""
      onLoad={onLoad}
      onError={onError}
      className={cn("absolute inset-0 size-full object-cover", className)}
    />
  );
}

export function AvatarFallback({
  src,
  children,
  className,
}: AvatarFallbackProps) {
  const { imageStatus } = useAvatarContext();

  if (imageStatus === "loaded") return null;
  if (src) return <CascadingImage src={src} className={className} />;

  return (
    <span aria-hidden="true" className={className}>
      {children}
    </span>
  );
}
