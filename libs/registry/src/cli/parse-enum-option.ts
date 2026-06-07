export function parseEnumOption<T extends string>(
  value: string,
  validValues: readonly T[],
  optionName: string,
): T {
  if (!(validValues as readonly string[]).includes(value)) {
    throw new Error(`Invalid ${optionName}: "${value}". Must be one of: ${validValues.join(", ")}`);
  }
  return value as T;
}
