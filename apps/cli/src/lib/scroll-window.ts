interface VisibleWindow {
  scrollOffset: number;
  endIndex: number;
}

interface CalculateVisibleWindowOptions {
  totalItems: number;
  visibleCount: number;
  currentOffset?: number;
  selectedIndex?: number;
}

/**
 * Calculate the visible window for a scrollable list.
 * If selectedIndex is provided, the window will adjust to keep it visible.
 */
export function calculateVisibleWindow({
  totalItems,
  visibleCount,
  currentOffset,
  selectedIndex,
}: CalculateVisibleWindowOptions): VisibleWindow {
  if (totalItems <= visibleCount) {
    return { scrollOffset: 0, endIndex: totalItems };
  }

  let scrollOffset = currentOffset ?? 0;

  if (selectedIndex !== undefined && selectedIndex >= 0) {
    if (selectedIndex < scrollOffset) {
      scrollOffset = selectedIndex;
    } else if (selectedIndex >= scrollOffset + visibleCount) {
      scrollOffset = selectedIndex - visibleCount + 1;
    }
  }

  scrollOffset = Math.max(0, Math.min(scrollOffset, totalItems - visibleCount));

  return {
    scrollOffset,
    endIndex: Math.min(scrollOffset + visibleCount, totalItems),
  };
}
