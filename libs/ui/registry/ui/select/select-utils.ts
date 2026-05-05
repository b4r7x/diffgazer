export function isValueSelected(value: string | string[], itemValue: string): boolean {
  return Array.isArray(value) ? value.includes(itemValue) : value === itemValue;
}

export function toSelectedArray(value: string | string[], multiple: boolean): string[] {
  if (multiple) return Array.isArray(value) ? value : [];
  return value ? [value as string] : [];
}

export function toOptionId(listboxId: string, value: string): string {
  return `${listboxId}-opt-${value.replace(/\s+/g, "_")}`;
}
