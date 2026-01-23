/** Truncates combined string to maxLength, keeping newest characters (removes from beginning). */
export function truncateToDisplayLength(
  existing: string,
  newContent: string,
  maxLength: number
): string {
  const combined = existing + newContent;
  if (combined.length <= maxLength) {
    return combined;
  }
  return combined.slice(-maxLength);
}
