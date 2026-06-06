"use client";

import { useEffect, useState } from "react";

interface UseSpinnerAnimationOptions {
  totalFrames: number;
  speed: number;
}

export function useSpinnerAnimation({ totalFrames, speed }: UseSpinnerAnimationOptions): number {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(totalFrames) || totalFrames <= 0 || !Number.isFinite(speed) || speed <= 0) {
      setFrame(0);
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | undefined;
    const mql = typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;

    function sync() {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
      if (mql?.matches) {
        setFrame(0);
      } else {
        intervalId = setInterval(() => setFrame(f => (f + 1) % totalFrames), speed);
      }
    }

    sync();
    mql?.addEventListener("change", sync);

    return () => {
      mql?.removeEventListener("change", sync);
      if (intervalId !== undefined) clearInterval(intervalId);
    };
  }, [speed, totalFrames]);

  return frame;
}
