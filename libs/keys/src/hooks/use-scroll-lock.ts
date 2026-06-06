"use client";

import { type RefObject, useEffect, useRef } from "react";

const lockCounts = new WeakMap<Element, number>();
const savedOverflow = new WeakMap<Element, string>();

export interface UseScrollLockOptions {
  target?: RefObject<HTMLElement | null>;
  enabled?: boolean;
}

function lockElement(el: HTMLElement): () => void {
  const count = lockCounts.get(el) ?? 0;

  if (count === 0) {
    savedOverflow.set(el, el.style.overflow);
    el.style.overflow = "hidden";
  }
  lockCounts.set(el, count + 1);

  return () => {
    const current = lockCounts.get(el) ?? 1;
    const next = current - 1;
    if (next <= 0) {
      lockCounts.delete(el);
      el.style.overflow = savedOverflow.get(el) ?? "";
      savedOverflow.delete(el);
    } else {
      lockCounts.set(el, next);
    }
  };
}

// Effect-on-every-render is intentional: React does not re-fire effects when
// target.current mutates while the ref object stays stable.
export function useScrollLock(options: UseScrollLockOptions = {}): void {
  const { target, enabled = true } = options;
  const lockedElementRef = useRef<HTMLElement | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);

  // No dependency array on purpose; see hook-level comment above.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const nextElement = enabled ? target?.current ?? document.body : null;
    if (lockedElementRef.current === nextElement) return;

    releaseRef.current?.();
    releaseRef.current = null;
    lockedElementRef.current = null;

    if (!nextElement) return;

    releaseRef.current = lockElement(nextElement);
    lockedElementRef.current = nextElement;
  });

  useEffect(() => {
    return () => {
      releaseRef.current?.();
      releaseRef.current = null;
      lockedElementRef.current = null;
    };
  }, []);
}
