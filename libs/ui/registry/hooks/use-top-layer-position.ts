"use client";

import { type RefObject, useLayoutEffect, useState } from "react";
import type { createTopLayerStack } from "@/lib/top-layer-stack";

/** Registers an element while active and reports whether it is topmost. */
export function useTopLayerPosition(
  stack: ReturnType<typeof createTopLayerStack>,
  ref: RefObject<HTMLElement | null>,
  active: boolean,
): boolean {
  const [isTop, setIsTop] = useState(false);

  useLayoutEffect(() => {
    if (!active) return;

    const element = ref.current;
    if (!element) return;

    const ownerDocument = element.ownerDocument;
    const unsubscribe = stack.subscribe(ownerDocument, () => setIsTop(stack.isTop(element)));

    stack.push(element);

    return () => {
      unsubscribe();
      stack.pop(element);
      setIsTop(false);
    };
  }, [active, ref, stack]);

  return isTop;
}
