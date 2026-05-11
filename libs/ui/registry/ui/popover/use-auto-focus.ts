"use client";

import { useEffect, type RefObject } from "react";
import { getFirstFocusableElement } from "@diffgazer/keys";

export function useAutoFocus(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  fallbackToContainer = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    const frame = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el || el.contains(el.ownerDocument.activeElement)) return;
      const target = getFirstFocusableElement(el);
      const focusTarget = target ?? (fallbackToContainer ? el : null);
      focusTarget?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [ref, enabled, fallbackToContainer]);
}
