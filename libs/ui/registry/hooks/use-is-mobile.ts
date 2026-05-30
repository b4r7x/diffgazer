"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * Returns `true` when the viewport is narrower than `breakpoint` (in pixels).
 *
 * Uses `matchMedia` via `useSyncExternalStore` for React 19 concurrent safety.
 * `getServerSnapshot` returns `false` so SSR renders the desktop layout —
 * consumers that need an SSR-known device class should branch on a user-agent
 * hint or a cookie instead.
 */
export function useIsMobile(breakpoint = 1024): boolean {
  // Required, not defensive: useSyncExternalStore re-subscribes whenever the
  // subscribe/getSnapshot identities change, so under React 19 concurrent
  // rendering an unmemoized pair would detach and re-attach the matchMedia
  // listener on every parent render. Memoizing keeps the subscription stable.
  const { subscribe, getSnapshot } = useMemo(() => {
    const query = `(max-width: ${breakpoint - 1}px)`;
    return {
      subscribe: (callback: () => void) => {
        if (typeof window === "undefined") return () => {};
        const mql = window.matchMedia(query);
        mql.addEventListener("change", callback);
        return () => mql.removeEventListener("change", callback);
      },
      getSnapshot: () => {
        if (typeof window === "undefined") return false;
        return window.matchMedia(query).matches;
      },
    };
  }, [breakpoint]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function getServerSnapshot(): boolean {
  return false;
}
