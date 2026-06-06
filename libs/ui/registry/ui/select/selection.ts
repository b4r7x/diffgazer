export function isValueSelected(value: string | null | string[], itemValue: string): boolean {
  return Array.isArray(value) ? value.includes(itemValue) : value === itemValue;
}

export function toSelectedArray(value: string | null | string[], multiple: boolean): string[] {
  if (multiple) return Array.isArray(value) ? value : [];
  return value === null ? [] : [value as string];
}

export function toOptionId(listboxId: string, value: string): string {
  const encoded = Array.from(value, (char) => char.codePointAt(0)?.toString(36) ?? "0").join("-");
  return `${listboxId}-opt-${encoded || "empty"}`;
}

export function isActiveOptionVisible(
  options: ReadonlyMap<string, { label: string; disabled: boolean }>,
  value: string | null,
  searchQuery: string,
  matches: (label: string, query: string) => boolean,
): value is string {
  if (value === null) return false;
  const option = options.get(value);
  return !!option && !option.disabled && matches(option.label, searchQuery);
}
