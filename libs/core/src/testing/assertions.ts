export function requireValue<T>(value: T | null | undefined, label: string): NonNullable<T> {
  if (value == null) {
    throw new Error(`Expected ${label}`);
  }
  return value;
}
