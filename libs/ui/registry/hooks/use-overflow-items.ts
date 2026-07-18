"use client";

import {
  type RefCallback,
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
  ref: RefCallback<HTMLDivElement>;
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
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const attachmentRef = useRef<{ generation: number; node: HTMLDivElement | null }>({
    generation: 0,
    node: null,
  });
  const [visibleCount, setVisibleCount] = useState(() => clampCount(itemCount, itemCount));
  const lastNotifiedCountRef = useRef(visibleCount);
  const notifyVisibleCountChange = useEffectEvent((count: number) => {
    onVisibleCountChange?.(count);
  });

  const safeItemCount = clampCount(itemCount, itemCount);
  const ref = useCallback((nextContainer: HTMLDivElement | null) => {
    attachmentRef.current = {
      generation: attachmentRef.current.generation + 1,
      node: nextContainer,
    };
    setContainer(nextContainer);
  }, []);

  useLayoutEffect(() => {
    if (!container) {
      setVisibleCount(safeItemCount);
      return;
    }

    const generation = attachmentRef.current.generation;
    const view = container.ownerDocument.defaultView ?? globalThis;
    let active = true;
    let frame: number | null = null;
    const isCurrentAttachment = () => {
      const attachment = attachmentRef.current;
      return active && attachment.generation === generation && attachment.node === container;
    };
    const recalculate = () => {
      if (!isCurrentAttachment()) return;

      const children = Array.from(container.children) as HTMLElement[];
      if (safeItemCount === 0 || children.length === 0) {
        setVisibleCount(0);
        return;
      }

      const containerWidth = container.offsetWidth;
      const gap = parseFloat(view.getComputedStyle(container).gap) || 0;
      const items = children.slice(0, safeItemCount);
      const indicator = children[safeItemCount];
      const itemWidths = items.map((element) => element.offsetWidth);
      const indicatorWidth = indicator ? indicator.offsetWidth : 0;

      setVisibleCount(
        clampCount(
          computeVisibleCount(itemWidths, containerWidth, gap, indicatorWidth),
          safeItemCount,
        ),
      );
    };
    const scheduleRecalculate = () => {
      if (!isCurrentAttachment() || frame != null) return;
      if (typeof view.requestAnimationFrame !== "function") {
        recalculate();
        return;
      }
      frame = view.requestAnimationFrame(() => {
        frame = null;
        recalculate();
      });
    };

    const ResizeObserverCtor = view.ResizeObserver;
    const resizeObserver =
      typeof ResizeObserverCtor === "function" ? new ResizeObserverCtor(scheduleRecalculate) : null;
    const observeChildren = () => {
      if (!isCurrentAttachment()) return;
      resizeObserver?.disconnect();
      resizeObserver?.observe(container);
      for (const child of Array.from(container.children)) {
        resizeObserver?.observe(child);
      }
    };
    const MutationObserverCtor = view.MutationObserver;
    const mutationObserver =
      typeof MutationObserverCtor === "function"
        ? new MutationObserverCtor(() => {
            if (!isCurrentAttachment()) return;
            observeChildren();
            scheduleRecalculate();
          })
        : null;

    observeChildren();
    mutationObserver?.observe(container, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
    });
    recalculate();

    return () => {
      active = false;
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      if (frame != null) {
        if (typeof view.cancelAnimationFrame === "function") view.cancelAnimationFrame(frame);
        frame = null;
      }
    };
  }, [container, safeItemCount]);

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
