/**
 * List navigation utilities - platform-agnostic helpers for scrollable lists
 * and keyboard navigation. Used by CLI and web for consistent behavior.
 */

export interface VisibleWindow {
  scrollOffset: number;
  endIndex: number;
}

export interface CalculateVisibleWindowOptions {
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

/**
 * Find the next enabled item in a list, starting from currentIndex + 1.
 * Returns -1 if no enabled item is found.
 */
export function findNextEnabled<T extends { disabled?: boolean }>(
  items: T[],
  currentIndex: number
): number {
  for (let i = currentIndex + 1; i < items.length; i++) {
    if (!items[i]?.disabled) return i;
  }
  return -1;
}

/**
 * Find the previous enabled item in a list, starting from currentIndex - 1.
 * Returns -1 if no enabled item is found.
 */
export function findPrevEnabled<T extends { disabled?: boolean }>(
  items: T[],
  currentIndex: number
): number {
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (!items[i]?.disabled) return i;
  }
  return -1;
}
