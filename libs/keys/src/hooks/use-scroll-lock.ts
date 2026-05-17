"use client";

import { useEffect, useRef, type RefObject } from "react";

const lockCounts = new WeakMap<Element, number>();
const savedOverflow = new WeakMap<Element, string>();

export interface UseScrollLockOptions {
  /**
   * Element to lock. When omitted, defaults to the host `document.body`. In
   * multi-window / iframe setups, pass a ref to the owner document's body
   * (e.g. `useRef(triggerRef.current?.ownerDocument?.body)`) so the lock
   * applies to the correct document.
   */
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

/**
 * Lock scrolling on `target.current` (or the host `document.body`) while `enabled`.
 *
 * Effect-on-every-render is intentional. React does not re-fire effects when
 * `target.current` mutates while the ref object stays stable, so the effect
 * compares the current locked element to the next one on every render and
 * short-circuits when nothing changed. Reference counting in `lockElement`
 * keeps concurrent locks safe.
 *
 * Limitations (parity gaps vs `react-remove-scroll` / Radix `useScrollLock`):
 * - Default target is the host `document.body`. In multi-window / iframe
 *   setups, pass an explicit `target` so the lock targets the correct owner
 *   document, e.g. `target: useRef(triggerRef.current?.ownerDocument?.body)`.
 * - No iOS Safari rubber-band guard: setting `overflow: hidden` on body does
 *   not stop iOS touch scrolling. The page can still pan-scroll on iOS while
 *   the lock is active.
 * - No scrollbar-gutter compensation: removing the body scrollbar on desktop
 *   browsers causes a horizontal layout shift. Apply a `scrollbar-gutter:
 *   stable` rule, a `padding-right` reservation, or use the native `<dialog>`
 *   element (which compensates automatically) when this matters.
 * - Opt-in `preventLayoutShift` and `preventIosRubberBand` flags are planned
 *   as a follow-up for `react-remove-scroll` / Radix parity.
 */
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
