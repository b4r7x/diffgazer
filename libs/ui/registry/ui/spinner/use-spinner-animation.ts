"use client";

import { useState, useEffect } from "react";

interface UseSpinnerAnimationOptions {
  totalFrames: number;
  speed: number;
}

export function useSpinnerAnimation({ totalFrames, speed }: UseSpinnerAnimationOptions): number {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");

    let intervalId: ReturnType<typeof setInterval> | undefined;

    function sync() {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
      if (mql.matches) {
        setFrame(0);
      } else {
        intervalId = setInterval(() => setFrame(f => (f + 1) % totalFrames), speed);
      }
    }

    sync();
    mql.addEventListener("change", sync);

    return () => {
      mql.removeEventListener("change", sync);
      if (intervalId !== undefined) clearInterval(intervalId);
    };
  }, [speed, totalFrames]);

  return frame;
}
