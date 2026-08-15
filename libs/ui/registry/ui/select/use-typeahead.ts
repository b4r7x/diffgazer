"use client";

import { typeaheadSearch } from "@/lib/typeahead";
import type { SelectContextValue, SelectOptionMetadata } from "./select-context";
import { getVisibleEnabledOptionEntries } from "./visible-options";

interface UseSelectTypeaheadOptions {
  /** Reads the query buffer shared by the closed trigger and the open listbox. */
  readTypeaheadQuery: SelectContextValue["readTypeaheadQuery"];
  options: ReadonlyMap<string, SelectOptionMetadata>;
  searchQuery: string;
  /** Controlled highlighted item id. Pair with onHighlightChange. */
  highlighted: string | null;
  /** Updates highlighted. */
  setHighlighted: (value: string) => void;
}

/** Provides select typeahead behavior. */
export function useSelectTypeahead({
  readTypeaheadQuery,
  options,
  searchQuery,
  highlighted,
  setHighlighted,
}: UseSelectTypeaheadOptions) {
  // Returns true when the key was buffered into the typeahead query so callers
  // can suppress a competing Space-select or vim-navigation move for the same
  // keystroke. `extendOnly` keys are declined on an empty buffer.
  return function handleTypeahead(
    key: string,
    { extendOnly = false }: { extendOnly?: boolean } = {},
  ): boolean {
    const query = readTypeaheadQuery(key, { extendOnly });
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
