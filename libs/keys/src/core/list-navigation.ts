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
