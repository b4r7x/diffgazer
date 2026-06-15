import { isArrayDirty } from "../../forms.js";
import { LENS_IDS, type LensId } from "./lens.js";

/** Canonical subtitle for the Analysis settings surface ("lenses" per F-106). */
export const ANALYSIS_SETTINGS_SUBTITLE = "Choose which lenses run during reviews.";

export function isLensId(value: string | null): value is LensId {
  return (LENS_IDS as readonly string[]).includes(value as string);
}

export function resolveEffectiveLenses(
  defaultLenses: LensId[],
  selectedLenses: LensId[] | null,
  fallbackLenses: LensId[],
): LensId[] {
  if (selectedLenses !== null) return selectedLenses;
  return defaultLenses.length > 0 ? defaultLenses : fallbackLenses;
}

export function isLensSelectionDirty(
  currentLenses: LensId[],
  selectedLenses: LensId[] | null,
): boolean {
  return isArrayDirty(currentLenses, selectedLenses);
}
