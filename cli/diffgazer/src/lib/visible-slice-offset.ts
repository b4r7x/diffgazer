/**
 * Compute the start offset of a sliding window so that `highlightedIndex`
 * stays inside the visible slice. The window scrolls only when the highlight
 * would otherwise fall off the bottom, matching common terminal list UX.
 */
export function getVisibleSliceOffset(
  highlightedIndex: number,
  total: number,
  windowSize: number,
): number {
  if (total <= windowSize) return 0;
  const maxOffset = total - windowSize;
  if (highlightedIndex < windowSize) return 0;
  return Math.min(maxOffset, highlightedIndex - windowSize + 1);
}
