"use client";

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";

export type OverflowDirection = "horizontal" | "vertical" | "both";

export function useOverflow<T extends HTMLElement = HTMLElement>(
  direction: OverflowDirection = "horizontal"
): { ref: RefObject<T | null>; isOverflowing: boolean } {
  const ref = useRef<T | null>(null);
  const frameRef = useRef<number | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    const h = el.scrollWidth > el.clientWidth;
    const v = el.scrollHeight > el.clientHeight;

    setIsOverflowing({ horizontal: h, vertical: v, both: h || v }[direction]);
  }, [direction]);

  const scheduleCheck = useCallback(() => {
    if (frameRef.current != null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      check();
    });
  }, [check]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver(scheduleCheck);
    resizeObserver.observe(el);

    const mutationObserver = new MutationObserver(scheduleCheck);
    mutationObserver.observe(el, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [scheduleCheck]);

  useLayoutEffect(() => {
    check();
  }, [check]);

  return { ref, isOverflowing };
}
