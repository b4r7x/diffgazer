"use client";

import { useRef, useEffect, useEffectEvent } from "react";

// Fallback timeout for reduced-motion: onAnimationEnd won't fire when
// motion-safe:animate-* classes are suppressed by prefers-reduced-motion.
const DISMISS_FALLBACK_MS = 200;

export function useToastDismiss(
  dismissing: boolean,
  id: string,
  onRemove: (id: string) => void,
) {
  const removedRef = useRef(false);
  const stableOnRemove = useEffectEvent(onRemove);

  useEffect(() => {
    if (!dismissing) {
      removedRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (!removedRef.current) {
        removedRef.current = true;
        stableOnRemove(id);
      }
    }, DISMISS_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [dismissing, id]);

  return {
    onAnimationEnd: () => {
      if (dismissing && !removedRef.current) {
        removedRef.current = true;
        stableOnRemove(id);
      }
    },
  };
}
