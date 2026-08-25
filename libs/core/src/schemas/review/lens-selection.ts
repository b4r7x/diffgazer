import { isMember } from "../fields.js";
import { SELECTABLE_LENS_IDS, type SelectableLensId } from "./lens.js";

function isArrayDirty<T>(persisted: T[], choice: T[] | null): boolean {
  if (choice === null) return false;
  if (persisted.length !== choice.length) return true;
  return persisted.some((item) => !choice.includes(item));
}

export function isSelectableLensId(value: string | null): value is SelectableLensId {
  return isMember(SELECTABLE_LENS_IDS, value);
}

function resolveEffectiveLenses(
  defaultLenses: SelectableLensId[],
  selectedLenses: SelectableLensId[] | null,
  fallbackLenses: SelectableLensId[],
): SelectableLensId[] {
  if (selectedLenses !== null) return selectedLenses;
  return defaultLenses.length > 0 ? defaultLenses : fallbackLenses;
}

export function deriveLensSelectionState(
  persistedRaw: Array<string | null>,
  selected: SelectableLensId[] | null,
  fallback: SelectableLensId[],
): { effective: SelectableLensId[]; isDirty: boolean; hasSelection: boolean } {
  const persisted = persistedRaw.filter(isSelectableLensId);
  const current = persisted.length > 0 ? persisted : fallback;
  const effective = resolveEffectiveLenses(persisted, selected, fallback);

  return {
    effective,
    isDirty: isArrayDirty(current, selected),
    hasSelection: effective.length > 0,
  };
}
