"use client";
import { useEffect, useState } from "react";
import type { AvatarStatus } from "./avatar-context";

/** Square avatar with src/fallback/size. Shows image or monospace initials. */
interface ImageStatusState {
  /** Image URL. Ignored when children are provided. */
  src: string | undefined;
  /** Current status value. */
  status: AvatarStatus;
}

/** Provides image status behavior. */
export function useImageStatus(src: string | undefined) {
  const [state, setState] = useState<ImageStatusState>(() => ({
    src,
    status: src ? "loading" : "idle",
  }));

  let status: AvatarStatus = "idle";
  if (state.src === src) {
    status = state.status;
  } else if (src) {
    status = "loading";
  }

  useEffect(() => {
    setState((current) =>
      current.src === src ? current : { src, status: src ? "loading" : "idle" },
    );
  }, [src]);

  return {
    status,
    showImage: !!src && status !== "error",
    onLoad: () => setState({ src, status: "loaded" }),
    onError: () => setState({ src, status: "error" }),
  };
}
