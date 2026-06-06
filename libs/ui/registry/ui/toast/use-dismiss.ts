"use client";

import { useEffect, useRef } from "react";

// Belt-and-braces removal: if onAnimationEnd fails to fire (animation disabled
// via OS settings, forced-colors layer overrides, or the slide token resolved
// to `none` before the reduced-motion fade class loaded), the toast must still
// unmount. Matches the exit-animation budget (slide-out 0.15s + fade-out 0.15s).
const DISMISS_FALLBACK_MS = 200;

export function useToastDismiss(
  dismissing: boolean,
  id: string,
  onRemove: (id: string) => void,
) {
  const removedRef = useRef(false);

  useEffect(() => {
    if (!dismissing) {
      removedRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (!removedRef.current) {
        removedRef.current = true;
        onRemove(id);
      }
    }, DISMISS_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [dismissing, id, onRemove]);

  return {
    onAnimationEnd: () => {
      if (dismissing && !removedRef.current) {
        removedRef.current = true;
        onRemove(id);
      }
    },
  };
}
