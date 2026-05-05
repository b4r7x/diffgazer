"use client";

import { useLayoutEffect, useRef, useState, useEffectEvent } from "react";

export type OverflowDirection = "horizontal" | "vertical" | "both";

export function useOverflow<T extends HTMLElement = HTMLElement>(
  direction: OverflowDirection = "horizontal"
): { ref: React.RefObject<T | null>; isOverflowing: boolean } {
  const ref = useRef<T | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const check = useEffectEvent(() => {
    const el = ref.current;
    if (!el) return;

    const h = el.scrollWidth > el.clientWidth;
    const v = el.scrollHeight > el.clientHeight;

    setIsOverflowing({ horizontal: h, vertical: v, both: h || v }[direction]);
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    check();
  }, [direction]);

  return { ref, isOverflowing };
}
