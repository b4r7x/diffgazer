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
