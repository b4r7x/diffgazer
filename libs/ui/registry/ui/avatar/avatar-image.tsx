"use client";

import { useEffect, type ImgHTMLAttributes, type Ref } from "react";
import { cn } from "@/lib/utils";
import { useAvatarContext } from "./avatar-context";
import { useImageStatus } from "./use-image-status";

export interface AvatarImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "alt"> {
  /**
   * Accessible name for the image. Defaults to `""`, treating the avatar as
   * decorative so it is skipped by assistive tech and the surrounding control
   * (button, link, card) supplies the accessible name. Pass an explicit `alt`
   * when the avatar is the sole label for its container.
   */
  alt?: string;
  ref?: Ref<HTMLImageElement>;
}

export function AvatarImage({
  src,
  alt,
  className,
  ref,
  ...imgProps
}: AvatarImageProps) {
  const { setImageStatus } = useAvatarContext();
  const { status, showImage, onLoad, onError } = useImageStatus(src);

  useEffect(() => {
    setImageStatus(status);
  }, [status, setImageStatus]);

  useEffect(() => {
    return () => setImageStatus("idle");
  }, [setImageStatus]);

  if (!showImage) return null;

  return (
    <img
      ref={ref}
      src={src}
      alt={alt ?? ""}
      onLoad={onLoad}
      onError={onError}
      className={cn("absolute inset-0 size-full object-cover", className)}
      {...imgProps}
    />
  );
}
