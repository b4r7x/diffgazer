export function findNextEnabled<T extends { disabled?: boolean }>(
  items: T[],
  currentIndex: number
): number {
  for (let i = currentIndex + 1; i < items.length; i++) {
    if (!items[i]?.disabled) return i;
  }
  return -1;
}

export function findPrevEnabled<T extends { disabled?: boolean }>(
  items: T[],
  currentIndex: number
): number {
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (!items[i]?.disabled) return i;
  }
  return -1;
}
