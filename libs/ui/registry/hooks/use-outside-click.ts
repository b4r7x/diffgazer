"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";

export function useOutsideClick(
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  enabled: boolean = true,
  excludeRefs?: ReadonlyArray<RefObject<HTMLElement | null>>,
): void {
  const onOutsideClick = useEffectEvent((target: Node) => {
    if (excludeRefs?.some(r => r.current?.contains(target))) return;
    handler();
  });

  useEffect(() => {
    if (!enabled) return;

    const handleClick = (e: MouseEvent) => {
      if (!(e.target instanceof Node)) return;
      if (ref.current && !ref.current.contains(e.target)) {
        onOutsideClick(e.target);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [enabled]);
}
