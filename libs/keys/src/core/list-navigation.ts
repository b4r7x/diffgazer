export interface HighlightNavigationItem {
  id: string;
  disabled?: boolean;
}

export interface MoveHighlightResult {
  index: number;
  id: string;
  hitBoundary: boolean;
}

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

  const boundaryIndex =
    items[currentIndex]?.disabled === true
      ? direction === 1
        ? lastEnabledIndex
        : firstEnabledIndex
      : currentIndex;
  return createMoveHighlightResult(items, boundaryIndex, true);
}
