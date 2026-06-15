/** Item shape consumed by `moveHighlight` when calculating list movement. */
export interface HighlightNavigationItem {
  /** Stable identifier returned when this item becomes highlighted. */
  id: string;
  /** Whether navigation should skip this item. */
  disabled?: boolean;
}

/** Result of moving highlight through a list of enabled items. */
export interface MoveHighlightResult {
  /** Index of the item that should be highlighted after movement. */
  index: number;
  /** Identifier of the item that should be highlighted after movement. */
  id: string;
  /** Whether movement stopped at the current edge instead of advancing. */
  hitBoundary: boolean;
}

/**
 * Moves a numeric index by one step, clamping at list edges or wrapping around
 * when requested.
 */
export function clampIndex(
  currentIndex: number,
  direction: 1 | -1,
  length: number,
  wrap: boolean,
): number {
  if (length <= 0) return 0;
  const nextIndex = currentIndex + direction;
  if (wrap) {
    return ((nextIndex % length) + length) % length;
  }
  return Math.max(0, Math.min(nextIndex, length - 1));
}

function getLastEnabledIndex<T extends HighlightNavigationItem>(items: readonly T[]): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (!items[index]?.disabled) {
      return index;
    }
  }
  return -1;
}

function findEnabledIndex<T extends HighlightNavigationItem>(
  items: readonly T[],
  startIndex: number,
  direction: 1 | -1,
): number {
  for (let index = startIndex + direction; index >= 0 && index < items.length; index += direction) {
    if (!items[index]?.disabled) {
      return index;
    }
  }
  return -1;
}

function createMoveHighlightResult<T extends HighlightNavigationItem>(
  items: readonly T[],
  index: number,
  hitBoundary: boolean,
): MoveHighlightResult | null {
  const item = items[index];
  if (item === undefined) return null;
  return { index, id: item.id, hitBoundary };
}

/**
 * Finds the next enabled item relative to the current item id, skipping disabled
 * entries and reporting boundaries when wrapping is disabled.
 */
export function moveHighlight<T extends HighlightNavigationItem>(
  items: readonly T[],
  currentId: string | null | undefined,
  direction: 1 | -1,
  wrap: boolean,
): MoveHighlightResult | null {
  if (items.length === 0) return null;

  const firstEnabledIndex = items.findIndex((item) => !item.disabled);
  if (firstEnabledIndex === -1) return null;

  const lastEnabledIndex = getLastEnabledIndex(items);
  const currentIndex = currentId == null ? -1 : items.findIndex((item) => item.id === currentId);

  if (currentIndex === -1) {
    const fallbackIndex = direction === 1 || !wrap ? firstEnabledIndex : lastEnabledIndex;
    return createMoveHighlightResult(items, fallbackIndex, false);
  }

  const nextIndex = findEnabledIndex(items, currentIndex, direction);
  if (nextIndex !== -1) {
    return createMoveHighlightResult(items, nextIndex, false);
  }

  if (wrap) {
    const wrappedIndex = direction === 1 ? firstEnabledIndex : lastEnabledIndex;
    return createMoveHighlightResult(items, wrappedIndex, false);
  }

  let boundaryIndex = currentIndex;
  if (items[currentIndex]?.disabled === true) {
    boundaryIndex = direction === 1 ? lastEnabledIndex : firstEnabledIndex;
  }
  return createMoveHighlightResult(items, boundaryIndex, true);
}
