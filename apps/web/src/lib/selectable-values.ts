export function resolveAvailableValue<T extends string>(
  values: readonly T[],
  ...candidates: readonly (string | null | undefined)[]
): T | null {
  for (const candidate of candidates) {
    const value = values.find((item) => item === candidate);
    if (value !== undefined) return value;
  }

  return values[0] ?? null;
}

/**
 * Returns the input list with `value` toggled in or out — used to centralize
 * Enter-key activation behavior for app-local CheckboxGroup consumers.
 */
export function toggleListValue<T extends string>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}
