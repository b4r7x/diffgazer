"use client";

import { useLayoutEffect, useRef, useState, useEffectEvent } from "react";

export interface UseOverflowItemsOptions {
  itemCount: number;
  onVisibleCountChange?: (count: number) => void;
}

export interface UseOverflowItemsReturn {
  ref: React.RefObject<HTMLDivElement | null>;
  visibleCount: number;
  overflowCount: number;
}

export function computeVisibleCount(
  itemWidths: number[],
  containerWidth: number,
  gap: number,
  indicatorWidth: number,
): number {
  let usedWidth = 0;
  for (let i = 0; i < itemWidths.length; i++) {
    const nextWidth = usedWidth + itemWidths[i]! + (i > 0 ? gap : 0);
    const remaining = itemWidths.length - (i + 1);
    const reserve = remaining > 0 ? indicatorWidth + gap : 0;
    if (nextWidth + reserve > containerWidth && i > 0) return i;
    usedWidth = nextWidth;
  }
  return itemWidths.length;
}

export function useOverflowItems({
  itemCount,
  onVisibleCountChange,
}: UseOverflowItemsOptions): UseOverflowItemsReturn {
  const ref = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(itemCount);

  const onRecalculate = useEffectEvent(() => {
    const container = ref.current;
    if (!container) return;

    const children = Array.from(container.children) as HTMLElement[];
    if (children.length === 0) return;

    const containerWidth = container.offsetWidth;
    const gap = parseFloat(getComputedStyle(container).gap) || 0;

    const items = children.slice(0, itemCount);
    const indicator = children[itemCount];

    const itemWidths = items.map(el => el.offsetWidth);
    const indicatorWidth = indicator ? indicator.offsetWidth : 0;

    const count = computeVisibleCount(itemWidths, containerWidth, gap, indicatorWidth);

    if (count !== visibleCount) {
      setVisibleCount(count);
      onVisibleCountChange?.(count);
    }
  });

  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;

    const observer = new ResizeObserver(onRecalculate);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    onRecalculate();
  }, [itemCount]);

  return {
    ref,
    visibleCount,
    overflowCount: itemCount - visibleCount,
  };
}
