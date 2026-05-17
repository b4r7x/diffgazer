/**
 * Cycling-prefix typeahead search.
 *
 * Given a typed query and an ordered collection of items, return the next item
 * whose label starts with the query. When the query is a single repeated
 * character (e.g. "aaa"), behave as a cycle through items starting with that
 * character. When the query has multiple distinct characters, search from the
 * top of the list (no cycle), so users can refine.
 *
 * The function is rendering-agnostic: it returns the matched item and lets the
 * caller decide what to do (set highlight, scroll into view, etc.).
 *
 * Labels are compared with `String.prototype.toLocaleLowerCase()` using the
 * host environment's default locale so locale-sensitive characters (e.g.
 * Turkish dotted/dotless I) round-trip consistently with the query buffer.
 */
export interface TypeaheadSearchOptions<Item> {
  items: readonly Item[];
  query: string;
  currentIndex: number;
  getLabel: (item: Item) => string;
}

export function typeaheadSearch<Item>({
  items,
  query,
  currentIndex,
  getLabel,
}: TypeaheadSearchOptions<Item>): Item | null {
  if (items.length === 0 || query.length === 0) return null;

  const isCyclingChar = query.length > 1 && query.split("").every((char) => char === query[0]);
  const search = isCyclingChar ? query[0]! : query;
  const startIndex = isCyclingChar || query.length === 1 ? currentIndex + 1 : 0;

  for (let offset = 0; offset < items.length; offset++) {
    const index = (startIndex + offset) % items.length;
    const item = items[index]!;
    const label = getLabel(item).toLocaleLowerCase();
    if (label.startsWith(search)) return item;
  }

  return null;
}
