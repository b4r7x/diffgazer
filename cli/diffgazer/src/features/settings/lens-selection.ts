import type { LensId } from "@diffgazer/core/schemas/review";

export function isLensSelectionDirty(
  currentLenses: LensId[],
  selectedLenses: LensId[] | null,
): boolean {
  if (selectedLenses === null) return false;
  if (currentLenses.length !== selectedLenses.length) return true;
  return currentLenses.some((lens) => !selectedLenses.includes(lens));
}

export function resolveEffectiveLenses(
  defaultLenses: LensId[],
  selectedLenses: LensId[] | null,
  fallbackLenses: LensId[],
): LensId[] {
  if (selectedLenses !== null) return selectedLenses;
  return defaultLenses.length > 0 ? defaultLenses : fallbackLenses;
}
