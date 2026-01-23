/**
 * Truncate a string to a maximum length, adding ellipsis if needed.
 */
export function truncate(str: string, maxLength: number, suffix = "..."): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Slugify a string for use in URLs or identifiers.
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
