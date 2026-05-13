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
