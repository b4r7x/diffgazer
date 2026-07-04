"use client";

import { useTypeaheadBuffer } from "@/hooks/use-typeahead-buffer";
import { typeaheadSearch } from "@/lib/typeahead";
import type { SelectOptionMetadata } from "./select-context";
import { getVisibleEnabledOptionEntries } from "./visible-options";

interface UseSelectTypeaheadOptions {
  options: ReadonlyMap<string, SelectOptionMetadata>;
  searchQuery: string;
  /** Controlled highlighted item id. Pair with onHighlightChange. */
  highlighted: string | null;
  /** Updates highlighted. */
  setHighlighted: (value: string) => void;
}

/** Provides select typeahead behavior. */
export function useSelectTypeahead({
  options,
  searchQuery,
  highlighted,
  setHighlighted,
}: UseSelectTypeaheadOptions) {
  const readTypeaheadQuery = useTypeaheadBuffer();

  // Returns true when the key was buffered into the typeahead query so callers
  // can suppress a competing Space-select for the same keystroke.
  return function handleTypeahead(key: string): boolean {
    const query = readTypeaheadQuery(key);
    if (query === null) return false;

    const visibleOptions = getVisibleEnabledOptionEntries(options, searchQuery);
    if (visibleOptions.length === 0) return true;

    const currentIndex =
      highlighted === null
        ? -1
        : visibleOptions.findIndex(([itemValue]) => itemValue === highlighted);

    const match = typeaheadSearch({
      items: visibleOptions,
      query,
      currentIndex,
      getLabel: ([, option]) => option.label,
    });

    if (match) setHighlighted(match[0]);
    return true;
  };
}
