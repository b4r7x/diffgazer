"use client";
import { useState } from "react";
import type { AvatarStatus } from "./avatar-context";

export function useImageStatus(src: string | undefined) {
  const [status, setStatus] = useState<AvatarStatus>(src ? "loading" : "idle");

  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setStatus(src ? "loading" : "idle");
  }

  return {
    status,
    showImage: !!src && status !== "error",
    onLoad: () => setStatus("loaded"),
    onError: () => setStatus("error"),
  };
}
