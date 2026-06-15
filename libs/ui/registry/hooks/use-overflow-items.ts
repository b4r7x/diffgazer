"use client";

import {
  type RefObject,
  useCallback,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/** Options for measuring how many child items fit in a single overflow row. */
export interface UseOverflowItemsOptions {
  /** Number of items to lay out. The first itemCount children are measured as items. */
  itemCount: number;
  /** Called when the visible count changes. */
  onVisibleCountChange?: (count: number) => void;
}

/** Reactive measurement result for an overflow-items container. */
export interface UseOverflowItemsReturn {
  /** Attach to the container element that owns item children followed by the overflow indicator. */
  ref: RefObject<HTMLDivElement | null>;
  /** Number of items that fit within the container width. */
  visibleCount: number;
  /** Number of items that do not fit. */
  overflowCount: number;
}

/** Computes how many item widths fit in the container while reserving room for the overflow indicator. */
export function computeVisibleCount(
  itemWidths: number[],
  containerWidth: number,
  gap: number,
  indicatorWidth: number,
): number {
  const safeContainerWidth = Number.isFinite(containerWidth) ? Math.max(0, containerWidth) : 0;
  const safeGap = Number.isFinite(gap) ? Math.max(0, gap) : 0;
  const safeIndicatorWidth = Number.isFinite(indicatorWidth) ? Math.max(0, indicatorWidth) : 0;
  const widths = itemWidths.map((width) => (Number.isFinite(width) ? Math.max(0, width) : 0));

  let usedWidth = 0;
  for (const [i, width] of widths.entries()) {
    const nextWidth = usedWidth + width + (i > 0 ? safeGap : 0);
    const remaining = widths.length - (i + 1);
    const reserve = remaining > 0 ? safeIndicatorWidth + safeGap : 0;
    if (nextWidth + reserve > safeContainerWidth && i > 0) return i;
    usedWidth = nextWidth;
  }
  return widths.length;
}

function clampCount(count: number, itemCount: number): number {
  const safeItemCount = Number.isFinite(itemCount) ? Math.max(0, Math.floor(itemCount)) : 0;
  if (!Number.isFinite(count)) return 0;
  return Math.min(Math.max(0, Math.floor(count)), safeItemCount);
}

/** Measures visible and overflow item counts for a flex row with a trailing indicator child. */
export function useOverflowItems({
  itemCount,
  onVisibleCountChange,
}: UseOverflowItemsOptions): UseOverflowItemsReturn {
  const ref = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(() => clampCount(itemCount, itemCount));
  const lastNotifiedCountRef = useRef(visibleCount);
  const notifyVisibleCountChange = useEffectEvent((count: number) => {
    onVisibleCountChange?.(count);
  });

  const safeItemCount = clampCount(itemCount, itemCount);

  const onRecalculate = useCallback(() => {
    const container = ref.current;
    if (!container) {
      setVisibleCount((current) => clampCount(current, safeItemCount));
      return;
    }

    const children = Array.from(container.children) as HTMLElement[];
    if (safeItemCount === 0 || children.length === 0) {
      setVisibleCount(0);
      return;
    }

    const containerWidth = container.offsetWidth;
    const gap = parseFloat(getComputedStyle(container).gap) || 0;

    const items = children.slice(0, safeItemCount);
    const indicator = children[safeItemCount];

    const itemWidths = items.map((el) => el.offsetWidth);
    const indicatorWidth = indicator ? indicator.offsetWidth : 0;

    const count = clampCount(
      computeVisibleCount(itemWidths, containerWidth, gap, indicatorWidth),
      safeItemCount,
    );

    setVisibleCount(count);
  }, [safeItemCount]);

  const scheduleRecalculate = useCallback(() => {
    if (frameRef.current != null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      onRecalculate();
    });
  }, [onRecalculate]);

  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(scheduleRecalculate);
    const observeChildren = () => {
      resizeObserver.disconnect();
      resizeObserver.observe(container);
      for (const child of Array.from(container.children)) {
        resizeObserver.observe(child);
      }
    };
    const mutationObserver = new MutationObserver(() => {
      observeChildren();
      scheduleRecalculate();
    });

    observeChildren();
    mutationObserver.observe(container, {
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
  }, [scheduleRecalculate]);

  useLayoutEffect(() => {
    onRecalculate();
  }, [onRecalculate]);

  useLayoutEffect(() => {
    if (visibleCount === lastNotifiedCountRef.current) return;
    lastNotifiedCountRef.current = visibleCount;
    notifyVisibleCountChange(visibleCount);
  }, [visibleCount]);

  return {
    ref,
    visibleCount: clampCount(visibleCount, safeItemCount),
    overflowCount: Math.max(0, safeItemCount - clampCount(visibleCount, safeItemCount)),
  };
}
