import { isArrayDirty } from "@diffgazer/core/forms";
import type { LensId } from "@diffgazer/core/schemas/review";

export function isLensSelectionDirty(
  currentLenses: LensId[],
  selectedLenses: LensId[] | null,
): boolean {
  return isArrayDirty(currentLenses, selectedLenses);
}

export function resolveEffectiveLenses(
  defaultLenses: LensId[],
  selectedLenses: LensId[] | null,
  fallbackLenses: LensId[],
): LensId[] {
  if (selectedLenses !== null) return selectedLenses;
  return defaultLenses.length > 0 ? defaultLenses : fallbackLenses;
}
