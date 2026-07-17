"use client";

import { type RefObject, useEffect, useRef } from "react";

const lockCounts = new WeakMap<Element, number>();
const savedOverflow = new WeakMap<Element, string>();
const savedPaddingRight = new WeakMap<Element, string>();

/** Options for preventing body or element scrolling. */
export interface UseScrollLockOptions {
  /** Ref to the element to lock. Defaults to `document.body` when omitted. */
  target?: RefObject<HTMLElement | null>;
  /** Whether the scroll lock is active. */
  enabled?: boolean;
}

function measureScrollbarWidth(el: HTMLElement): number {
  const ownerDocument = el.ownerDocument;
  const isViewport = el === ownerDocument.body || el === ownerDocument.scrollingElement;
  if (isViewport) {
    const view = ownerDocument.defaultView;
    if (!view) return 0;
    return view.innerWidth - ownerDocument.documentElement.clientWidth;
  }
  const style = ownerDocument.defaultView?.getComputedStyle(el);
  const borderLeft = style ? Number.parseFloat(style.borderLeftWidth) || 0 : 0;
  const borderRight = style ? Number.parseFloat(style.borderRightWidth) || 0 : 0;
  return Math.max(0, el.offsetWidth - el.clientWidth - borderLeft - borderRight);
}

function lockElement(el: HTMLElement): () => void {
  const count = lockCounts.get(el) ?? 0;

  if (count === 0) {
    savedOverflow.set(el, el.style.overflow);
    savedPaddingRight.set(el, el.style.paddingRight);

    const scrollbarWidth = measureScrollbarWidth(el);
    if (scrollbarWidth > 0) {
      const view = el.ownerDocument.defaultView;
      const currentPaddingRight = view
        ? Number.parseFloat(view.getComputedStyle(el).paddingRight) || 0
        : 0;
      el.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
    }

    el.style.overflow = "hidden";
    el.setAttribute("data-scroll-locked", "");
  }
  lockCounts.set(el, count + 1);

  return () => {
    const current = lockCounts.get(el) ?? 1;
    const next = current - 1;
    if (next <= 0) {
      lockCounts.delete(el);
      el.style.overflow = savedOverflow.get(el) ?? "";
      el.style.paddingRight = savedPaddingRight.get(el) ?? "";
      el.removeAttribute("data-scroll-locked");
      savedOverflow.delete(el);
      savedPaddingRight.delete(el);
    } else {
      lockCounts.set(el, next);
    }
  };
}

// Effect-on-every-render is intentional: React does not re-fire effects when
// target.current mutates while the ref object stays stable.
/**
 * Locks scrolling by mutating the target element's overflow and padding, with
 * scrollbar-width compensation and shared reference counting. It installs no
 * event listeners.
 */
export function useScrollLock(options: UseScrollLockOptions = {}): void {
  const { target, enabled = true } = options;
  const lockedElementRef = useRef<HTMLElement | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);

  // No dependency array on purpose; see hook-level comment above.
  useEffect(() => {
    let nextElement: HTMLElement | null = null;
    if (enabled) {
      nextElement = target ? target.current : document.body;
    }
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
