import { clampIndex } from "@diffgazer/keys";

export interface NavigableItem {
  id: string;
  disabled: boolean;
}

export interface MoveHighlightResult {
  index: number;
  id: string;
  hitBoundary: boolean;
}

/**
 * Given a list of items, the current highlighted id, a direction (+1/-1),
 * and a wrap flag, returns the next highlighted index/id and whether the
 * move hit a boundary. Disabled items are skipped automatically because
 * the caller is expected to pass `items.filter(i => !i.disabled)`.
 */
export function moveHighlight<T extends NavigableItem>(
  selectableItems: readonly T[],
  currentId: string,
  direction: 1 | -1,
  wrap: boolean,
): MoveHighlightResult | null {
  if (selectableItems.length === 0) return null;
  const currentIdx = selectableItems.findIndex((item) => item.id === currentId);
  const fromIdx = currentIdx === -1 ? (direction === 1 ? -1 : 0) : currentIdx;
  const nextIdx = clampIndex(fromIdx, direction, selectableItems.length, wrap);
  const nextItem = selectableItems[nextIdx];
  if (!nextItem) return null;
  const hitBoundary =
    !wrap &&
    ((direction === 1 && currentIdx === selectableItems.length - 1) ||
      (direction === -1 && currentIdx === 0));
  return { index: nextIdx, id: nextItem.id, hitBoundary };
}

/**
 * Resolves the next index without item identity, used by list primitives
 * that track only an index (e.g. CheckboxGroup).
 */
export function stepIndex(
  currentIndex: number,
  direction: 1 | -1,
  length: number,
  wrap: boolean,
): number {
  return clampIndex(currentIndex, direction, length, wrap);
}
