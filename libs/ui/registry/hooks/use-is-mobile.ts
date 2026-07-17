"use client";

import { type RefObject, useMemo, useSyncExternalStore } from "react";

export type MobileViewportOwner = Window | RefObject<Element | null>;

function resolveOwnerWindow(owner: MobileViewportOwner | undefined): Window | null {
  if (owner === undefined) {
    return typeof window === "undefined" ? null : window;
  }
  if ("matchMedia" in owner) return owner;
  return owner.current?.ownerDocument.defaultView ?? null;
}

/**
 * Returns `true` when the viewport is narrower than `breakpoint` (in pixels).
 *
 * Uses `matchMedia` via `useSyncExternalStore` for React 19 concurrent safety.
 * Pass an owning `Window` or an element ref when rendering into another
 * document so the query follows that viewport rather than the host window.
 * `getServerSnapshot` returns `false` so SSR renders the desktop layout —
 * consumers that need an SSR-known device class should branch on a user-agent
 * hint or a cookie instead.
 */
export function useIsMobile(breakpoint = 1024, owner?: MobileViewportOwner): boolean {
  // Required, not defensive: useSyncExternalStore re-subscribes whenever the
  // subscribe/getSnapshot identities change, so under React 19 concurrent
  // rendering an unmemoized pair would detach and re-attach the matchMedia
  // listener on every parent render. Memoizing keeps the subscription stable.
  const { subscribe, getSnapshot } = useMemo(() => {
    const query = `(max-width: ${breakpoint - 1}px)`;
    let queryWindow: Window | null = null;
    let mediaQueryList: MediaQueryList | null = null;

    const getMediaQueryList = () => {
      const nextWindow = resolveOwnerWindow(owner);
      if (!nextWindow) return null;
      if (nextWindow !== queryWindow) {
        queryWindow = nextWindow;
        mediaQueryList = nextWindow.matchMedia(query);
      }
      return mediaQueryList;
    };

    return {
      subscribe: (callback: () => void) => {
        const mql = getMediaQueryList();
        if (!mql) return () => {};
        mql.addEventListener("change", callback);
        return () => mql.removeEventListener("change", callback);
      },
      getSnapshot: () => getMediaQueryList()?.matches ?? false,
    };
  }, [breakpoint, owner]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function getServerSnapshot(): boolean {
  return false;
}
