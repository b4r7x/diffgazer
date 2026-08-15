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
  const [element, setElement] = useState<HTMLElement | null>(null);

  // Ref-to-state promotion with equality bail; must observe every render so an
  // element that attaches after `active` is already true still gets registered.
  useLayoutEffect(() => {
    const nextElement = ref.current;
    setElement((current) => (current === nextElement ? current : nextElement));
  });

  useLayoutEffect(() => {
    if (!active || !element) return;

    const ownerDocument = element.ownerDocument;
    const unsubscribe = stack.subscribe(ownerDocument, () => setIsTop(stack.isTop(element)));

    stack.push(element);

    return () => {
      unsubscribe();
      stack.pop(element);
      setIsTop(false);
    };
  }, [active, element, stack]);

  return isTop;
}
