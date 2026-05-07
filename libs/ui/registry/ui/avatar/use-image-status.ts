"use client";
import { useEffect, useState } from "react";
import type { AvatarStatus } from "./avatar-context";

interface ImageStatusState {
  src: string | undefined;
  status: AvatarStatus;
}

export function useImageStatus(src: string | undefined) {
  const [state, setState] = useState<ImageStatusState>(() => ({
    src,
    status: src ? "loading" : "idle",
  }));

  const status = state.src === src ? state.status : (src ? "loading" : "idle");

  useEffect(() => {
    setState((current) => (
      current.src === src
        ? current
        : { src, status: src ? "loading" : "idle" }
    ));
  }, [src]);

  return {
    status,
    showImage: !!src && status !== "error",
    onLoad: () => setState({ src, status: "loaded" }),
    onError: () => setState({ src, status: "error" }),
  };
}
