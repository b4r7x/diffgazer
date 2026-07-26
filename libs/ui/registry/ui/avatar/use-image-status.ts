"use client";
import { useState } from "react";
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

  let status: AvatarStatus = "idle";
  if (state.src === src) {
    status = state.status;
  } else if (src) {
    status = "loading";
  }

  return {
    showImage: !!src && status !== "error",
    onLoad: () => setState({ src, status: "loaded" }),
    onError: () => setState({ src, status: "error" }),
  };
}
