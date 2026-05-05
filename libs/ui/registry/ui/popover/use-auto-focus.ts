"use client";

import { useEffect, type RefObject } from "react";
import { FOCUSABLE_SELECTOR } from "@/lib/focus";

export function useAutoFocus(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return;
    const frame = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el || el.contains(document.activeElement)) return;
      const target = el.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (target ?? el).focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [ref, enabled]);
}
