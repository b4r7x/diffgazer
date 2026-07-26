import { isArrayDirty } from "../../forms.js";
import { isMember } from "../fields.js";
import { LENS_IDS, type LensId } from "./lens.js";

export function isLensId(value: string | null): value is LensId {
  return isMember(LENS_IDS, value);
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

export function deriveLensSelectionState(
  persistedRaw: Array<string | null>,
  selected: LensId[] | null,
  fallback: LensId[],
): { effective: LensId[]; isDirty: boolean; hasSelection: boolean } {
  const persisted = persistedRaw.filter(isLensId);
  const current = persisted.length > 0 ? persisted : fallback;
  const effective = resolveEffectiveLenses(persisted, selected, fallback);

  return {
    effective,
    isDirty: isLensSelectionDirty(current, selected),
    hasSelection: effective.length > 0,
  };
}
