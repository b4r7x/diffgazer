/** Inputs for searching a cyclic list with a typeahead query. */
export interface TypeaheadSearchOptions<Item> {
  /** Items to search in their rendered order. */
  items: readonly Item[];
  /** Lowercased typeahead query. Repeating the same character cycles matches. */
  query: string;
  /** Current highlighted item index, used as the starting point for cycling. */
  currentIndex: number;
  /** Returns the accessible label for an item. */
  getLabel: (item: Item) => string;
}

/**
 * Folds a query or label to one comparable form: NFC so composed and decomposed
 * spellings of the same characters match, then locale-aware lowercase, then NFC
 * again because case mapping can denormalize.
 */
function foldTypeaheadValue(value: string): string {
  return value.normalize("NFC").toLocaleLowerCase().normalize("NFC");
}

/** Finds the next item whose label starts with the typeahead query. */
export function typeaheadSearch<Item>({
  items,
  query,
  currentIndex,
  getLabel,
}: TypeaheadSearchOptions<Item>): Item | null {
  if (items.length === 0 || query.length === 0) return null;

  const foldedQuery = foldTypeaheadValue(query);
  // Code points, not code units, so an astral first character is one character here.
  const queryChars = [...foldedQuery];
  const firstChar = queryChars[0] ?? "";
  const isCyclingChar = queryChars.length > 1 && queryChars.every((char) => char === firstChar);
  const search = isCyclingChar ? firstChar : foldedQuery;
  const startIndex = isCyclingChar || queryChars.length === 1 ? currentIndex + 1 : 0;

  for (let offset = 0; offset < items.length; offset++) {
    const index = (startIndex + offset) % items.length;
    const item = items[index];
    if (item === undefined) continue;
    if (foldTypeaheadValue(getLabel(item)).startsWith(search)) return item;
  }

  return null;
}
