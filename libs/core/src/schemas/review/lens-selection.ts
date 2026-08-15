import { isMember } from "../fields.js";
import { LENS_IDS, type LensId } from "./lens.js";

function isArrayDirty<T>(persisted: T[], choice: T[] | null): boolean {
  if (choice === null) return false;
  if (persisted.length !== choice.length) return true;
  return persisted.some((item) => !choice.includes(item));
}

export function isLensId(value: string | null): value is LensId {
  return isMember(LENS_IDS, value);
}

function resolveEffectiveLenses(
  defaultLenses: LensId[],
  selectedLenses: LensId[] | null,
  fallbackLenses: LensId[],
): LensId[] {
  if (selectedLenses !== null) return selectedLenses;
  return defaultLenses.length > 0 ? defaultLenses : fallbackLenses;
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
    isDirty: isArrayDirty(current, selected),
    hasSelection: effective.length > 0,
  };
}
