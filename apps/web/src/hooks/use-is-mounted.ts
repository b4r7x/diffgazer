import { type RefObject, useEffect, useRef } from "react";

/**
 * Tracks whether the calling component is still mounted, so a request that
 * outlives the screen it was started from can skip the work that would reach
 * past it — app-wide keys can leave the page while a save or a review start is
 * in flight, and a late navigate or toast would land on whatever screen the
 * user moved to.
 */
export function useIsMountedRef(): RefObject<boolean> {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return isMountedRef;
}
