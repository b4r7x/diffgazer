// Locale-independent code-unit comparison so committed fingerprints and copy
// bundles order files identically on every machine (see libs/core catalog
// transform). Do not replace with `localeCompare` — it is locale-dependent.
export function compareCodeUnits(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
