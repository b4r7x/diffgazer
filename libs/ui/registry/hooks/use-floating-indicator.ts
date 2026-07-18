"use client";

import { type RefObject, useLayoutEffect, useState } from "react";

/** Container-relative rectangle for the active indicator target. */
export interface FloatingIndicatorRect {
  /** Left offset from the container's left edge. */
  left: number;
  /** Measured target width. */
  width: number;
  /** Top offset from the container's top edge. */
  top: number;
  /** Measured target height. */
  height: number;
}

/**
 * Measures the bounding box of the currently active item inside a container
 * and returns it in container-relative coordinates. Used by sliding-pill
 * variants (Mantine FloatingIndicator pattern) so a single indicator element
 * can transform between siblings.
 *
 * The hook owns the CSS-escape of `activeValue` so the caller does not need
 * to import the DOM-only `CSS` global — keeping the SSR boundary explicit.
 *
 * A `MutationObserver` re-measures when the container's children change
 * (lazy lists, deferred mounts) so the indicator re-pins itself when the
 * active item appears later or is replaced.
 *
 * Returns `null` until the first measurement lands so consumers can suppress
 * the indicator entirely on first paint (avoids "pill slides in from 0" on
 * mount).
 */
export function useFloatingIndicator(
  containerRef: RefObject<HTMLElement | null>,
  activeValue: string | null,
): FloatingIndicatorRect | null {
  const [rect, setRect] = useState<FloatingIndicatorRect | null>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  // Ref-to-state promotion with equality bail; must observe every render.
  useLayoutEffect(() => {
    const nextContainer = containerRef.current;
    setContainer((currentContainer) =>
      currentContainer === nextContainer ? currentContainer : nextContainer,
    );
  });

  useLayoutEffect(() => {
    if (!container || activeValue == null) {
      setRect(null);
      return;
    }

    const findTarget = (): HTMLElement | null =>
      Array.from(container.querySelectorAll<HTMLElement>("[data-value]")).find(
        (node) => node.getAttribute("data-value") === activeValue,
      ) ?? null;

    let currentTarget: HTMLElement | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    const measure = () => {
      const target = findTarget();
      if (!target) {
        if (currentTarget) {
          resizeObserver?.unobserve(currentTarget);
          currentTarget = null;
        }
        setRect(null);
        return;
      }
      if (target !== currentTarget) {
        if (currentTarget) resizeObserver?.unobserve(currentTarget);
        resizeObserver?.observe(target);
        currentTarget = target;
      }
      const containerBox = container.getBoundingClientRect();
      const itemBox = target.getBoundingClientRect();
      setRect({
        left: itemBox.left - containerBox.left,
        width: itemBox.width,
        top: itemBox.top - containerBox.top,
        height: itemBox.height,
      });
    };

    measure();
    const view = container.ownerDocument.defaultView ?? globalThis;
    const ResizeObserverCtor = view.ResizeObserver;
    if (typeof ResizeObserverCtor === "function") {
      resizeObserver = new ResizeObserverCtor(measure);
      resizeObserver.observe(container);
      if (currentTarget) resizeObserver.observe(currentTarget);
    }
    const MutationObserverCtor = view.MutationObserver;
    if (typeof MutationObserverCtor === "function") {
      mutationObserver = new MutationObserverCtor(measure);
      mutationObserver.observe(container, { childList: true, subtree: true });
    }

    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [container, activeValue]);

  return rect;
}
