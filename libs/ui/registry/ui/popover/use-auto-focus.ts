"use client";

import { getFirstFocusableElement } from "@diffgazer/keys";
import { type RefObject, useEffect } from "react";

/** Provides auto focus behavior. */
export function useAutoFocus(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  fallbackToContainer = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    const element = ref.current;
    if (!element) return;
    const view = element.ownerDocument.defaultView ?? globalThis;
    const frame = view.requestAnimationFrame(() => {
      const el = ref.current;
      if (!el || el.contains(el.ownerDocument.activeElement)) return;
      const target = getFirstFocusableElement(el);
      const focusTarget = target ?? (fallbackToContainer ? el : null);
      focusTarget?.focus({ preventScroll: true });
    });
    return () => view.cancelAnimationFrame(frame);
  }, [ref, enabled, fallbackToContainer]);
}
