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

  useEffect(() => {
    if (!src) return;

    let active = true;
    const image = new Image();
    const markLoaded = () => {
      if (!active || image.naturalWidth === 0) return;
      setState({ src, status: "loaded" });
    };
    const markErrored = () => {
      if (active) setState({ src, status: "error" });
    };

    image.addEventListener("load", markLoaded);
    image.addEventListener("error", markErrored);
    image.src = src;
    if (image.complete) markLoaded();

    return () => {
      active = false;
      image.removeEventListener("load", markLoaded);
      image.removeEventListener("error", markErrored);
    };
  }, [src]);

  return {
    status,
    showImage: !!src && status !== "error",
    onLoad: () => setState({ src, status: "loaded" }),
    onError: () => setState({ src, status: "error" }),
  };
}
