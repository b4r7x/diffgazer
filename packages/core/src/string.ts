export function truncate(str: string, maxLength: number, suffix = "..."): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

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
