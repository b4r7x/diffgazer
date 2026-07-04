"use client";

import { type ImgHTMLAttributes, type Ref, useEffect, useEffectEvent } from "react";
import { cn } from "@/lib/utils";
import { useAvatarContext } from "./avatar-context";
import { useImageStatus } from "./use-image-status";

/** Props for avatar image. */
export interface AvatarImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "alt"> {
  /**
   * Accessible name for the image. Defaults to `""`, treating the avatar as decorative so it is
   * skipped by assistive tech and the surrounding control (button, link, card) supplies the
   * accessible name. Pass an explicit `alt` when the avatar is the sole label for its
   * container.
   */
  alt?: string;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLImageElement>;
}

export function AvatarImage({ src, alt, className, ref, ...imgProps }: AvatarImageProps) {
  const { setImageStatus } = useAvatarContext();
  const { showImage, onLoad, onError } = useImageStatus(src);
  const notifyStatus = useEffectEvent(setImageStatus);

  // Lifecycle sync only: the presence/absence of `src` decides the initial
  // loading/idle status, and unmount/src-change resets to idle. Load/error
  // transitions are notified directly from the event handlers below.
  useEffect(() => {
    notifyStatus(src ? "loading" : "idle");
    return () => notifyStatus("idle");
  }, [src]);

  if (!showImage) return null;

  return (
    <img
      ref={ref}
      src={src}
      alt={alt ?? ""}
      className={cn("absolute inset-0 size-full object-cover", className)}
      {...imgProps}
      onLoad={(event) => {
        onLoad();
        setImageStatus("loaded");
        imgProps.onLoad?.(event);
      }}
      onError={(event) => {
        onError();
        setImageStatus("error");
        imgProps.onError?.(event);
      }}
    />
  );
}
