export const capitalize = (value: string): string =>
  value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);

export const truncate = (value: string, maxLength: number, suffix = "..."): string =>
  value.length <= maxLength ? value : value.slice(0, maxLength - suffix.length) + suffix;

export const truncateToDisplayLength = (
  existing: string,
  newContent: string,
  maxLength: number
): string => {
  const combined = existing + newContent;
  if (combined.length <= maxLength) {
    return combined;
  }
  return combined.slice(-maxLength);
};
