export function getCompatibilityLabel({
  total,
  compatible,
  hasParams,
}: {
  total: number;
  compatible: number;
  hasParams: boolean;
}): string {
  if (total === 0) return "No models available.";
  if (compatible < total) {
    return `Showing ${compatible}/${total} models that support structured outputs.`;
  }
  if (hasParams) return "Showing models that support structured outputs.";
  return "Compatibility unknown; showing all models.";
}
