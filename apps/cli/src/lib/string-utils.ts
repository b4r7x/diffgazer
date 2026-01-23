/**
 * Truncates content to maxLength, keeping the most recent characters.
 * When adding newContent to existing content exceeds maxLength,
 * removes oldest characters to make room.
 *
 * @param existing - The current accumulated content
 * @param newContent - New content to append
 * @param maxLength - Maximum allowed length for the combined result
 * @returns Combined string truncated to maxLength, preserving newest characters
 */
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
